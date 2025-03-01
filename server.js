const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg'); // Use PostgreSQL

const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : false
});


// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session Store with PostgreSQL
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: true  // Ensures the session table is created automatically
    }),
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 
    }
}));


console.log('Loaded session secret:', process.env.SESSION_SECRET);

// Sample route to test database connection
app.get('/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ success: true, time: result.rows[0].now });
    } catch (error) {
        console.error('Database connection error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/*
app.use((req, res, next) => {
    console.log('Session data:', req.session); // Log session data
    next();
});
*/

async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO friendshipstatus (statusid, statusname) VALUES
                ('p', 'Pending'),
                ('a', 'Accepted'),
                ('d', 'Declined')
            ON CONFLICT (statusid) DO NOTHING;
        `);
        console.log("Friendship status values inserted successfully.");
    } catch (error) {
        console.error("Error inserting initial friendship status values:", error);
    } finally {
        client.release();
    }
}

// Call this function during server startup
initializeDatabase();




app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});


// Set up Multer with Cloudinary storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "uploads",
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    },
});

const upload = multer({ storage });





const saltRounds = 10;




app.post('/register', async (req, res) => {
    const { schoolfullname, email, userfullname, password } = req.body;
    const userid = email;

    try {
        // **Check if the user already exists**
        const existingUser = await pool.query('SELECT userid FROM userprofile WHERE userid = $1', [userid]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'An account with this email already exists. Please sign up.' });
        }

        // **Check if school already exists**
        const existingSchool = await pool.query('SELECT schoolid FROM school WHERE schoolfullname = $1', [schoolfullname]);
        if (existingSchool.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'A school with this name already exists.' });
        }

        // **Insert new school**
        const insertSchoolResult = await pool.query(
            'INSERT INTO school (schoolfullname) VALUES ($1) RETURNING schoolid',
            [schoolfullname]
        );
        const schoolid = insertSchoolResult.rows[0].schoolid;

        console.log(`Assigned school ID: ${schoolid} for moderator: ${userid}`);

        // **Hash the password**
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // **Insert moderator**
        await pool.query(
            'INSERT INTO userprofile (userid, userfullname, userpasswordhash, schoolid, userrole) VALUES ($1, $2, $3, $4, $5)',
            [userid, userfullname, hashedPassword, schoolid, 'm']
        );

        // **Save session**
        req.session.userid = userid;
        res.json({ success: true });

    } catch (err) {
        console.error('Error during moderator registration:', err.message);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});





// Helper function to get the schoolid
async function getschoolid(schoolfullname) {
    try {
        const query = 'SELECT schoolid FROM school WHERE schoolfullname = $1';
        const result = await pool.query(query, [schoolfullname]);

        if (result.rows.length === 0) {
            throw new Error('School does not exist');
        }

        return result.rows[0].schoolid;
    } catch (err) {
        throw err;
    }
}

// Signup Endpoint
app.post('/signup', async (req, res) => {
    const { email, fullName, password, school, year } = req.body;
    const userid = email; // Assuming userid is the email

    try {
        // **Check if user already exists**
        const existingUser = await pool.query('SELECT userid FROM userprofile WHERE userid = $1', [userid]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
        }

        // **Check if school exists**
        const schoolResult = await pool.query('SELECT schoolid FROM school WHERE schoolfullname = $1', [school]);
        if (schoolResult.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'The specified school does not exist. Please contact your school administrator.' });
        }
        const schoolid = schoolResult.rows[0].schoolid;

        // **Hash the password securely**
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // **Insert user into the database**
        const query = `
            INSERT INTO userprofile (userid, userfullname, userpasswordhash, schoolid, usergraduationyear, userrole) 
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING userid
        `;

        await pool.query(query, [userid, fullName, hashedPassword, schoolid, year, 's']);

        // **Save user session**
        req.session.userid = userid;
        res.json({ success: true });

    } catch (error) {
        console.error('Error processing signup:', error.message);
        res.status(500).json({ success: false, message: 'An error occurred while processing signup. Please try again later.' });
    }
});

// Login Endpoint
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const query = 'SELECT * FROM userprofile WHERE userid = $1';
        const result = await pool.query(query, [email]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const user = result.rows[0];

        const match = await bcrypt.compare(password, user.userpasswordhash);

        if (match) {
            // Successful login, save the session
            req.session.userid = user.userid;
            req.session.save((err) => {
                if (err) {
                    console.error('Error saving session:', err.message);
                    return res.status(500).json({ success: false, message: 'Session error' });
                }
                return res.status(200).json({ success: true, userid: user.userid });
            });
        } else {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

    } catch (error) {
        console.error('Error during login:', error.message);
        return res.status(500).json({ success: false, message: 'Server error occurred' });
    }
});

// Logout Endpoint
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to log out' });
        }
        res.clearCookie('connect.sid'); // Clear session cookie
        return res.send({ success: true, message: 'Logged out successfully' });
    });
});




// FETCHING USER id FROM SESSION
app.get('/session-userid', (req, res) => {
    const userid = req.session.userid; // Ensure `userid` is set in the session
    res.json({ success: true, userid: userid });
});

// FETCHING FULL NAME FROM DATABASE
app.get('/user/:userid', async (req, res) => {
    const userid = req.params.userid;

    try {
        const query = 'SELECT userfullname FROM userprofile WHERE userid = $1';
        const result = await pool.query(query, [userid]);

        if (result.rows.length > 0) {
            res.json({ success: true, userfullname: result.rows[0].userfullname });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        console.error('Error fetching user full name:', error.message);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});



// Create a new post with media
app.post('/post', upload.array('media', 5), async (req, res) => {
    console.log('Received request at /post'); 
    console.log('Request body:', req.body);
    console.log('Uploaded files:', req.files);

    const { text, category, month, privacy } = req.body;
    const userid = req.session.userid;
    const postdate = new Date().toISOString();

    if (!userid) {
        return res.status(400).json({ success: false, message: 'User not logged in' });
    }

    try {
        // Insert post into the database
        const insertPostQuery = `INSERT INTO post 
            (userid, postcascategoryid, postmonthid, posttext, postdate, postprivacyid) 
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING postid`;

        const result = await pool.query(insertPostQuery, [userid, category, month, text, postdate, privacy]);
        const postid = result.rows[0].postid;

        if (req.files.length > 0) {
            // Insert Cloudinary URLs into the database
            const mediaValues = req.files.map(file => `(${postid}, '${file.path}')`).join(",");
            const insertMediaQuery = `INSERT INTO media (postid, mediafile) VALUES ${mediaValues}`;
            await pool.query(insertMediaQuery);
        }

        res.json({ success: true, postid });

    } catch (err) {
        console.error('Error inserting post:', err.message);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});


// FETCHING MEDIA
app.get('/media/:postid', async (req, res) => {
    const postid = req.params.postid;
    const query = 'SELECT mediafile FROM media WHERE postid = $1';

    try {
        const result = await pool.query(query, [postid]);

        // Send back the Cloudinary URLs as they are
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching media:', err.message);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});





app.get('/posts', async (req, res) => {
    const userid = req.query.userid;
    let query = `SELECT * FROM post ORDER BY postdate DESC`;
    let params = [];

    if (userid) {
        query = `SELECT * FROM post WHERE userid = $1 ORDER BY postdate DESC`;
        params.push(userid);
    }

    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching posts:', err.message);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});





// Endpoint to load posts
app.get('/postload', async (req, res) => {
    const { userid, currentUser, userrole } = req.query;
    
    let query = `
        SELECT p.*
        FROM post p
        LEFT JOIN friends f ON 
            (p.userid = f.useraddresseeid AND f.useraddresserid = $1) 
            OR (p.userid = f.useraddresserid AND f.useraddresseeid = $2)
        WHERE 
            (p.postprivacyid = 3) OR 
            (p.postprivacyid = 2 AND (f.statusid = 'a' OR p.userid = $3 OR $4 = 'm')) OR 
            (p.postprivacyid = 1 AND (p.userid = $5 OR $6 = 'm'))
        ORDER BY p.postdate DESC;
    `;

    let params = [currentUser, currentUser, currentUser, userrole, currentUser, userrole];

    if (userid) {
        query = `
            SELECT p.*
            FROM post p
            LEFT JOIN friends f ON 
                (p.userid = f.useraddresseeid AND f.useraddresserid = $1) 
                OR (p.userid = f.useraddresserid AND f.useraddresseeid = $2)
            WHERE 
                (((p.postprivacyid = 3) OR 
                (p.postprivacyid = 2 AND (f.statusid = 'a' OR p.userid = $3 OR $4 = 'm')) OR 
                (p.postprivacyid = 1 AND (p.userid = $5 OR $6 = 'm'))) 
                AND p.userid = $7)
            ORDER BY p.postdate DESC;
        `;
        params.push(userid);
    }

    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching posts:', err.message);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});



// SEARCHING POSTS
app.get('/searchPosts', async (req, res) => {
    const client = await pool.connect();
    try {
        const searchTerm = (req.query.search || '').trim();
        const { categoryid, monthid, userid, privacyid, postid, currentUser, userrole } = req.query;

        let query = `
            SELECT post.*
            FROM post
            INNER JOIN userprofile ON post.userid = userprofile.userid
            LEFT JOIN friends f ON (post.userid = f.useraddresseeid AND f.useraddresserid = $1) 
                                OR (post.userid = f.useraddresserid AND f.useraddresseeid = $2)
            WHERE 1=1
        `;

        let queryParams = [currentUser, currentUser];

        if (searchTerm.length) {
            const searchTerms = searchTerm.split(',').map(term => term.trim()).filter(term => term.length > 0);
            if (!searchTerms.length) return res.status(400).json({ success: false, message: 'No valid search terms provided' });

            const conditions = searchTerms.map((_, i) => `(post.posttext ILIKE $${queryParams.length + 1 + i} OR userprofile.userfullname ILIKE $${queryParams.length + 1 + i})`).join(' OR ');
            queryParams.push(...searchTerms.map(term => `%${term}%`));

            query += ` AND (${conditions})`;
        }

        query += `
            AND (
                post.postprivacyid = 3 OR 
                (post.postprivacyid = 2 AND (f.statusid = 'a' OR $${queryParams.length + 1} = 'm' OR post.userid = $${queryParams.length + 2})) OR 
                (post.postprivacyid = 1 AND (post.userid = $${queryParams.length + 3} OR $${queryParams.length + 4} = 'm'))
            )
        `;

        queryParams.push(userrole, currentUser, currentUser, userrole);

        if (categoryid) query += ' AND post.postcascategoryid = $' + (queryParams.push(categoryid));
        if (monthid) query += ' AND post.postmonthid = $' + (queryParams.push(monthid));
        if (privacyid) query += ' AND post.postprivacyid = $' + (queryParams.push(privacyid));
        if (userid) query += ' AND post.userid = $' + (queryParams.push(userid));
        if (postid && postid !== 'null') query += ' AND post.postid = $' + (queryParams.push(postid));

        query += ' ORDER BY post.postdate DESC';

        console.log('SQL Query:', query);
        console.log('Query Parameters:', queryParams);

        const result = await client.query(query, queryParams);
        res.json({ success: true, posts: result.rows });

    } catch (err) {
        console.error('Error executing query:', err.message);
        res.status(500).json({ success: false, message: 'Database error' });
    } finally {
        client.release();
    }
});




app.get('/searchUser', async (req, res) => {
    const client = await pool.connect();
    try {
        const searchTerm = req.query.term ? `%${req.query.term.toLowerCase()}%` : '';
        const userid = req.query.userid;

        if (!searchTerm) {
            return res.status(400).json({ success: false, message: 'Search term is required' });
        }

        if (!userid) {
            return res.status(400).json({ success: false, message: 'User id is required' });
        }

        const query = `
            SELECT 
                userprofile.userid, 
                userprofile.userfullname, 
                userprofile.schoolid, 
                userprofile.usergraduationyear,
                school.schoolfullname
            FROM 
                userprofile
            LEFT JOIN 
                school ON userprofile.schoolid = school.schoolid
            WHERE 
                (LOWER(userprofile.userfullname) ILIKE $1 OR LOWER(school.schoolfullname) ILIKE $2)
                AND userprofile.userid != $3;
        `;

        const result = await client.query(query, [searchTerm, searchTerm, userid]);
        
        res.json({ success: true, users: result.rows });

    } catch (err) {
        console.error('Error executing query:', err.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        client.release();
    }
});




// LOADING COMMENTS
app.get('/comments', async (req, res) => {
    const client = await pool.connect();
    try {
        const { postid } = req.query;

        if (!postid) {
            return res.status(400).json({ success: false, message: 'Post id is required' });
        }

        // Fetch comments with user roles
        const commentQuery = `
            SELECT c.commentid, c.postid, c.commentdate, c.commenttext, c.commentinguserid, u.userfullname, u.userrole
            FROM comments c
            JOIN userprofile u ON c.commentinguserid = u.userid
            WHERE c.postid = $1
            ORDER BY 
                CASE WHEN u.userrole = 'm' THEN 0 ELSE 1 END, 
                c.commentdate DESC
        `;

        const { rows: comments } = await client.query(commentQuery, [postid]);

        res.json(comments);
    } catch (err) {
        console.error('Error fetching comments:', err.message);
        res.status(500).json({ success: false, message: 'Database error' });
    } finally {
        client.release();
    }
});



// ADDING NEW COMMENTS
app.post('/add-comments', async (req, res) => {
    const client = await pool.connect();
    try {
        const { postid, commenttext } = req.body;
        const commentinguserid = req.session.userid; // Assuming user is authenticated

        if (!postid || !commenttext || !commentinguserid) {
            return res.status(400).json({ success: false, message: 'Post id, comment text, and user id are required' });
        }

        const commentdate = new Date().toISOString(); // Get the current date and time in ISO format

        const query = `
            INSERT INTO comments (postid, commentdate, commenttext, commentinguserid) 
            VALUES ($1, $2, $3, $4) RETURNING commentid
        `;

        const { rows } = await client.query(query, [postid, commentdate, commenttext, commentinguserid]);

        res.json({ success: true, commentid: rows[0].commentid });

    } catch (err) {
        console.error('Error inserting comment:', err.message);
        res.status(500).json({ success: false, message: 'Database error' });
    } finally {
        client.release();
    }
});


// INSERTING RECORDS INTO LIKES
app.post('/like', async (req, res) => {
    const client = await pool.connect();
    try {
        const { postid } = req.body;
        const userid = req.session.userid; // Assuming user is authenticated

        if (!postid || !userid) {
            return res.status(400).json({ success: false, message: 'Post id and user id are required' });
        }

        const query = `
            INSERT INTO likes (postid, userid) 
            VALUES ($1, $2) 
            ON CONFLICT (postid, userid) DO NOTHING
        `;

        await client.query(query, [postid, userid]);

        res.json({ success: true });

    } catch (err) {
        console.error('Error inserting like:', err.message);
        res.status(500).json({ success: false, message: 'Database error' });
    } finally {
        client.release();
    }
});



// GETTING THE NUMBER OF LIKES
app.get('/like-count', async (req, res) => {
    const client = await pool.connect();
    try {
        const { postid } = req.query;

        if (!postid) {
            return res.status(400).json({ success: false, message: 'Post ID is required' });
        }

        const query = `
            SELECT COUNT(*) AS totallikes
            FROM likes
            WHERE postid = $1
        `;

        const { rows } = await client.query(query, [Number(postid)]); // Convert postid to number if necessary

        res.json({ totallikes: parseInt(rows[0].totallikes, 10) }); // Ensure proper number conversion

    } catch (err) {
        console.error('Error fetching likes:', err.message);
        res.status(500).json({ success: false, message: 'Database error' });
    } finally {
        client.release();
    }
});



// DELETING COMMENTS
app.delete('/comments/:commentid', async (req, res) => {
    const client = await pool.connect();
    try {
        const commentid = req.params.commentid;
        const userid = req.session.userid; // Assuming user is authenticated

        if (!commentid || !userid) {
            return res.status(400).json({ success: false, message: 'Comment id and user id are required' });
        }

        // Get user role and comment author
        const userQuery = `
            SELECT u.userrole, c.commentinguserid 
            FROM userprofile u
            LEFT JOIN comments c ON c.commentid = $1
            WHERE u.userid = $2
        `;

        const { rows } = await client.query(userQuery, [commentid, userid]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User or comment not found' });
        }

        const { userrole, commentinguserid } = rows[0];

        // Allow deletion for admins (`'m'`) or the comment's author
        if (userrole === 'm' || commentinguserid === userid) {
            const deleteQuery = `DELETE FROM comments WHERE commentid = $1`;
            await client.query(deleteQuery, [commentid]);

            res.json({ success: true });
        } else {
            res.status(403).json({ success: false, message: 'Not authorized to delete this comment' });
        }

    } catch (err) {
        console.error('Error deleting comment:', err.message);
        res.status(500).json({ success: false, message: 'Database error' });
    } finally {
        client.release();
    }
});



// FETCHING ROLE
app.get('/userRole', async (req, res) => {
    const client = await pool.connect();
    try {
        const userid = req.session.userid; // Assuming user is authenticated

        if (!userid) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const query = 'SELECT userrole FROM userprofile WHERE userid = $1';
        const { rows } = await client.query(query, [userid]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ role: rows[0].userrole, userid });

    } catch (err) {
        console.error('Error fetching user role:', err.message);
        res.status(500).json({ success: false, message: 'Database error' });
    } finally {
        client.release();
    }
});




// DELETING POSTS
app.delete('/posts/:postid', async (req, res) => {
    const client = await pool.connect();
    try {
        const postid = req.params.postid;
        const userid = req.session.userid; // Assuming user is authenticated

        if (!postid || !userid) {
            return res.status(400).json({ success: false, message: 'Post id and user id are required' });
        }

        console.log('Session userid:', userid);

        // Fetch user role and post author in a single query
        const userQuery = `
            SELECT u.userrole, p.userid AS postauthor 
            FROM userprofile u
            LEFT JOIN post p ON p.postid = $1
            WHERE u.userid = $2
        `;

        const { rows } = await client.query(userQuery, [postid, userid]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User or post not found' });
        }

        const { userrole, postauthor } = rows[0];

        if (userrole === 'm' || postauthor === userid) {
            // Delete comments first, then the post (maintain referential integrity)
            await client.query('DELETE FROM comments WHERE postid = $1', [postid]);
            await client.query('DELETE FROM post WHERE postid = $1', [postid]);

            res.json({ success: true });
        } else {
            res.status(403).json({ success: false, message: 'Not authorized to delete this post' });
        }

    } catch (err) {
        console.error('Error deleting post:', err.message);
        res.status(500).json({ success: false, message: 'Database error' });
    } finally {
        client.release();
    }
});




// Route to fetch user information and their posts
app.get('/user-info/:userid', async (req, res) => {
    const client = await pool.connect();
    try {
        const userid = req.params.userid;

        if (!userid) {
            console.error('User id not provided');
            return res.status(400).json({ success: false, message: 'User id is required' });
        }

        const query = `
            SELECT u.userid, u.userfullname, u.usergraduationyear, u.userrole, s.schoolfullname
            FROM userprofile u
            LEFT JOIN school s ON u.schoolid = s.schoolid
            WHERE u.userid = $1
        `;


        const { rows } = await client.query(query, [userid]);

        if (rows.length === 0) {
            console.error('User not found');
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, ...rows[0] });

    } catch (err) {
        console.error('Error fetching user info:', err.message);
        res.status(500).json({ success: false, message: 'Database error' });
    } finally {
        client.release();
    }
});



app.get('/user-statistics/:userid', async (req, res) => {
    const client = await pool.connect();
    try {
        const userid = req.params.userid;

        const totalPostsQuery = 'SELECT COUNT(*) AS "totalPosts" FROM post WHERE userid = $1';

        const postsByCategoryQuery = `
            SELECT postcascategoryid, COUNT(*) AS count
            FROM post
            WHERE userid = $1
            GROUP BY postcascategoryid
        `;

        const totalPostsResult = await client.query(totalPostsQuery, [userid]);
        const postsByCategoryResult = await client.query(postsByCategoryQuery, [userid]);

        res.json({ 
            success: true, 
            totalPosts: totalPostsResult.rows[0].totalPosts, 
            postsByCategory: postsByCategoryResult.rows 
        });

    } catch (err) {
        console.error('Error fetching user statistics:', err);
        res.status(500).json({ error: 'Database error' });
    } finally {
        client.release();
    }
});



app.post('/api/friends/request', async (req, res) => {
    const client = await pool.connect();
    try {
        const { useraddresserid, useraddresseeid } = req.body;

        const query = `
            INSERT INTO friends (useraddresserid, useraddresseeid, statusid)
            VALUES ($1, $2, 'p')
        `;

        await client.query(query, [useraddresserid, useraddresseeid]);

        res.status(200).json({ message: 'Friend request sent' });

    } catch (err) {
        console.error('Error sending friend request:', err);
        res.status(500).json({ error: 'Failed to send friend request' });
    } finally {
        client.release();
    }
});


app.get('/check-status', async (req, res) => {
    const client = await pool.connect();
    try {
        const { useraddresserid, useraddresseeid } = req.query;

        if (!useraddresserid || !useraddresseeid) {
            return res.status(400).json({ error: 'Both useraddresserid and useraddresseeid are required' });
        }

        const query = `
            SELECT statusid, useraddresserid, useraddresseeid
            FROM friends
            WHERE (useraddresserid = $1 AND useraddresseeid = $2)
               OR (useraddresserid = $2 AND useraddresseeid = $1)
        `;

        const { rows } = await client.query(query, [useraddresserid, useraddresseeid]);

        if (rows.length > 0) {
            res.json({ status: rows[0].statusid, useraddresserid: rows[0].useraddresserid, useraddresseeid: rows[0].useraddresseeid });
        } else {
            res.json({ status: 'd', useraddresserid, useraddresseeid });
        }

    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    } finally {
        client.release();
    }
});



app.post('/api/friends/respond', async (req, res) => {
    const client = await pool.connect();
    try {
        const { useraddresserid, useraddresseeid, action } = req.body;

        if (!useraddresserid || !useraddresseeid || !['accept', 'decline'].includes(action)) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        if (action === 'decline') {
            const deleteQuery = `
                DELETE FROM friends
                WHERE (useraddresserid = $1 AND useraddresseeid = $2)
                   OR (useraddresserid = $2 AND useraddresseeid = $1)
            `;
            const result = await client.query(deleteQuery, [useraddresserid, useraddresseeid]);
            return res.json({ message: result.rowCount > 0 ? 'Friend request declined' : 'No request found' });
        }

        // Accept the friend request
        const updateQuery = `
            UPDATE friends
            SET statusid = 'a'
            WHERE (useraddresserid = $1 AND useraddresseeid = $2)
               OR (useraddresserid = $2 AND useraddresseeid = $1)
        `;
        const updateResult = await client.query(updateQuery, [useraddresserid, useraddresseeid]);

        res.json({ message: updateResult.rowCount > 0 ? 'Friend request accepted' : 'No request found' });

    } catch (err) {
        console.error('Error responding to friend request:', err);
        res.status(500).json({ error: 'Database error' });
    } finally {
        client.release();
    }
});



// Endpoint to get the three latest friends
// Updated endpoint to get the three latest friends with their names and ids
app.get('/api/friends/latest/:userid', async (req, res) => {
    const client = await pool.connect();
    try {
        const { userid } = req.params;

        const query = `
            SELECT u.userid, u.userfullname
            FROM friends f
            JOIN userprofile u ON u.userid = 
                CASE WHEN f.useraddresserid = $1 THEN f.useraddresseeid ELSE f.useraddresserid END
            WHERE (f.useraddresserid = $1 OR f.useraddresseeid = $1)
            AND f.statusid = 'a'
            ORDER BY f.friendshipid DESC
            LIMIT 3
        `;

        const { rows } = await client.query(query, [userid]);
        res.json({ success: true, friends: rows });

    } catch (err) {
        console.error('Error fetching latest friends:', err);
        res.status(500).json({ success: false, error: 'Database error' });
    } finally {
        client.release();
    }
});




// Endpoint to create a notification
// Endpoint to create a notification
app.post('/api/sendNotifications', async (req, res) => {
    const client = await pool.connect();
    try {
        const { userid, notificationtype, actorid, postid } = req.body;

        if (!userid || !notificationtype) {
            return res.status(400).json({ error: 'userid and notificationtype are required' });
        }

        if (userid === actorid) {
            return res.status(200).json({ message: 'No notification created: userid and actorid are the same' });
        }

        const query = `
            INSERT INTO notifications (userid, notificationtype, actorid, postid)
            VALUES ($1, $2, $3, $4)
        `;

        await client.query(query, [userid, notificationtype, actorid, postid]);

        res.status(200).json({ message: 'Notification created' });

    } catch (err) {
        console.error('Error creating notification:', err);
        res.status(500).json({ error: 'Database error' });
    } finally {
        client.release();
    }
});


// Endpoint to get notifications for a user
app.get('/api/getNotifications', async (req, res) => {
    const { userid } = req.query;

    if (!userid) {
        return res.status(400).json({ error: 'User id is required' });
    }

    try {
        const { rows } = await pool.query(`
            SELECT n.*, u.userfullname
            FROM notifications n
            JOIN userprofile u ON n.actorid = u.userid
            WHERE n.userid = $1 
            ORDER BY n.notificationtime DESC;
        `, [userid]);

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});




app.get('/api/getPostOwnerid', async (req, res) => {
    const { postid } = req.query;

    if (!postid) {
        return res.status(400).json({ error: 'postid is required' });
    }

    try {
        const { rows } = await pool.query('SELECT userid FROM post WHERE postid = $1', [postid]);

        if (rows.length > 0) {
            res.status(200).json({ userid: rows[0].userid });
        } else {
            res.status(404).json({ error: 'Post not found' });
        }
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});





app.post('/change-password', async (req, res) => {
    const { userid, oldPassword, newPassword } = req.body;

    if (!userid || !oldPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    try {
        // Start transaction
        await pool.query('BEGIN');

        // Get stored password hash
        const { rows } = await pool.query('SELECT userpasswordhash FROM userprofile WHERE userid = $1', [userid]);

        if (rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const storedHash = rows[0].userpasswordhash;

        // Compare old password with stored hash
        const match = await bcrypt.compare(oldPassword, storedHash);
        if (!match) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Incorrect old password' });
        }

        // Hash the new password
        const newHashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the password
        await pool.query('UPDATE userprofile SET userpasswordhash = $1 WHERE userid = $2', [newHashedPassword, userid]);

        // Commit transaction
        await pool.query('COMMIT');

        res.status(200).json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error changing password:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


