const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg'); // Use PostgreSQL
const multer = require('multer');
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
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session Store with PostgreSQL
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session', // Creates a 'session' table if not exists
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

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});




// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const saltRounds = 10;




// register endpoint
app.post('/register', async (req, res) => {
    const { schoolFullName, email, userFullName, password } = req.body;
    const userID = email; // Assuming userID is the email

    try {
        // Check if the school already exists
        const schoolResult = await pool.query('SELECT schoolID FROM school WHERE schoolFullName = $1', [schoolFullName]);

        let schoolID;
        if (schoolResult.rows.length === 0) {
            // School does not exist, insert it
            const insertSchoolResult = await pool.query(
                'INSERT INTO school (schoolFullName) VALUES ($1) RETURNING schoolID',
                [schoolFullName]
            );
            schoolID = insertSchoolResult.rows[0].schoolID;
        } else {
            // If school exists, get its ID
            schoolID = schoolResult.rows[0].schoolID;
        }

        // Hash the password securely
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert user data into userProfile table
        await pool.query(
            'INSERT INTO userProfile (userID, userFullName, userPasswordHash, schoolID, userRole) VALUES ($1, $2, $3, $4, $5)',
            [userID, userFullName, hashedPassword, schoolID, 'm']
        );

        // Save session data
        req.session.userID = userID;
        res.json({ success: true });

    } catch (err) {
        console.error('Error during registration:', err.message);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});



// Helper function to get the schoolID
async function getSchoolID(schoolFullName) {
    try {
        const query = 'SELECT schoolID FROM school WHERE schoolFullName = $1';
        const result = await pool.query(query, [schoolFullName]);

        if (result.rows.length === 0) {
            throw new Error('School does not exist');
        }

        return result.rows[0].schoolID;
    } catch (err) {
        throw err;
    }
}

// Signup Endpoint
app.post('/signup', async (req, res) => {
    const { email, fullName, password, school, year } = req.body;
    const userID = email; // Assuming userID is the email

    try {
        // Check if the school exists
        const schoolID = await getSchoolID(school);

        // Hash the password securely
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert user into the database
        const query = `
            INSERT INTO userProfile (userID, userFullName, userPasswordHash, schoolID, userGraduationYear, userRole) 
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING userID
        `;

        await pool.query(query, [userID, fullName, hashedPassword, schoolID, year, 's']);

        // Save the user session
        req.session.userID = userID;
        res.json({ success: true });

    } catch (error) {
        console.error('Error processing signup:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});





// Login Endpoint
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const query = 'SELECT * FROM userProfile WHERE userID = $1';
        const result = await pool.query(query, [email]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const user = result.rows[0];

        const match = await bcrypt.compare(password, user.userpasswordhash);

        if (match) {
            // Successful login, save the session
            req.session.userID = user.userid;
            req.session.save((err) => {
                if (err) {
                    console.error('Error saving session:', err.message);
                    return res.status(500).json({ success: false, message: 'Session error' });
                }
                return res.status(200).json({ success: true, userID: user.userid });
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




// FETCHING USER ID FROM SESSION
app.get('/session-userID', (req, res) => {
    const userID = req.session.userID; // Ensure `userID` is set in the session
    res.json({ success: true, userID: userID });
});

// FETCHING FULL NAME FROM DATABASE
app.get('/user/:userID', async (req, res) => {
    const userID = req.params.userID;

    try {
        const query = 'SELECT userFullName FROM userProfile WHERE userID = $1';
        const result = await pool.query(query, [userID]);

        if (result.rows.length > 0) {
            res.json({ success: true, userFullName: result.rows[0].userfullname });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        console.error('Error fetching user full name:', error.message);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});



const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Store files in the 'uploads/' folder
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`); // Create unique filenames based on current timestamp
    }
});

// File validation
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpg|jpeg|png|gif|webp/;
    const mimeType = allowedTypes.test(file.mimetype);
    const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    // Check file type
    if (mimeType && extName) {
        return cb(null, true); // Accept the file
    } else {
        cb(new Error('Only image files are allowed'), false); // Reject the file
    }
};

// File size validation 
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 15 * 1024 * 1024 }  // Limit files to 15MB
});



// Create a new post with media
app.post('/post', upload.array('media', 5), (req, res) => {
    console.log('Received request at /post'); // Debugging log
    console.log('Request body:', req.body);
    console.log('Uploaded files:', req.files);

    const { text, category, month, privacy } = req.body;
    const userID = req.session.userID; // Fetch userID from session
    const postDate = new Date().toISOString();

    if (!userID) {
        return res.status(400).json({ success: false, message: 'User not logged in' });
    }

    // Insert post into the database
    const insertPostQuery = 'INSERT INTO post (userID, postCASCategoryID, postMonthID, postText, postDate, postPrivacyID) VALUES (?, ?, ?, ?, ?, ?)';
    db.run(insertPostQuery, [userID, category, month, text, postDate, privacy], function (err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        const postID = this.lastID;
        const mediaFiles = req.files.map(file => [postID, file.filename]);

        if (mediaFiles.length > 0) {
            // Insert media file info into the database
            const insertMediaQuery = 'INSERT INTO media (postID, mediaFile) VALUES (?, ?)';
            db.parallelize(() => {
                const stmt = db.prepare(insertMediaQuery);
                mediaFiles.forEach(file => stmt.run(file, err => {
                    if (err) {
                        console.error('Error inserting media:', err.message);
                    }
                }));
                stmt.finalize();
            });
        }

        res.json({ success: true, postID: postID });
    });
});


app.get('/posts', (req, res) => {
    const userID = req.query.userID;

    // Base query
    let query = `SELECT * 
                 FROM post 
                 ORDER BY postDate DESC`; // Note: `ORDER BY` comes last

    const params = [];

    // Append `WHERE` clause if `userID` is provided
    if (userID) {
        query = `SELECT * 
                 FROM post
                 WHERE userID = ? 
                 ORDER BY postDate DESC`;
        params.push(userID);
    }

    console.log('Executing query:', query);
    console.log('With params:', params);

    db.all(query, params, (err, posts) => {
        if (err) {
            console.error('Error fetching posts:', err.message);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        // Ensure that `posts` is an array before responding
        if (!Array.isArray(posts)) {
            console.error('Invalid posts data format:', posts);
            return res.status(500).json({ success: false, message: 'Invalid posts data' });
        }

        res.json(posts);
    });
});





// FETCHING MEDIA
app.get('/media/:postID', (req, res) => {
    const postID = req.params.postID;
    const query = 'SELECT mediaFile FROM media WHERE postID = ?';
    db.all(query, [postID], (err, rows) => {
        if (err) {
            console.error('Error fetching media:', err.message);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json(rows);
    });
});


// Endpoint to load posts
app.get('/postload', (req, res) => {
    const userID = req.query.userID;
    const currentUser = req.query.currentUser;
    const userRole = req.query.userRole;  // Retrieve userRole from the query parameters

    // Base query
    let query = `
        SELECT p.*
        FROM post p
        LEFT JOIN friends f ON (p.userID = f.userAddresseeID AND f.userAddresserID = ?) 
                            OR (p.userID = f.userAddresserID AND f.userAddresseeID = ?)
        WHERE 
            ((p.postPrivacyID = 3) OR 
            (p.postPrivacyID = 2 AND (f.statusID = 'a' OR p.userID = ? OR ? = 'm')) OR 
            (p.postPrivacyID = 1 AND (p.userID = ? OR ? = 'm')))
        ORDER BY p.postDate DESC;
    `;
    
    // Array of parameters passed into the query
    const params = [currentUser, currentUser, currentUser, userRole, currentUser, userRole];

    // Append `WHERE` clause if `userID` is provided
    if (userID) {
        query = `SELECT p.*
                FROM post p
                LEFT JOIN friends f ON (p.userID = f.userAddresseeID AND f.userAddresserID = ?) 
                                    OR (p.userID = f.userAddresserID AND f.userAddresseeID = ?)
                WHERE 
                    (((p.postPrivacyID = 3) OR 
                    (p.postPrivacyID = 2 AND (f.statusID = 'a' OR p.userID = ? OR ? = 'm')) OR 
                    (p.postPrivacyID = 1 AND (p.userID = ? OR ? = 'm'))) 
                    AND p.userID = ?)
                ORDER BY p.postDate DESC;
        `;
        params.push(userID);
    }

    

    console.log('Executing query:', query);
    console.log('With params:', params);

    db.all(query, params, (err, posts) => {
        if (err) {
            console.error('Error fetching posts:', err.message);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        // Ensure that `posts` is an array before responding
        if (!Array.isArray(posts)) {
            console.error('Invalid posts data format:', posts);
            return res.status(500).json({ success: false, message: 'Invalid posts data' });
        }

        // Optionally, use userRole here for filtering or additional logic based on user role
        console.log('User Role:', userRole); // You can check the role to filter posts or permissions

        res.json(posts);
    });
});


// SEARCHING POSTS
app.get('/searchPosts', async (req, res) => {
    const client = await pool.connect();
    try {
        const searchTerm = (req.query.search || '').trim();
        const categoryID = req.query.categoryID;
        const monthID = req.query.monthID;
        const userID = req.query.userID;
        const privacyID = req.query.privacyID;
        const postID = parseInt(req.query.postID, 10);
        const currentUser = req.query.currentUser;
        const userRole = req.query.userRole;

        let query = `
            SELECT post.*
            FROM post
            INNER JOIN userProfile ON post.userID = userProfile.userID
            LEFT JOIN friends f ON (post.userID = f.userAddresseeID AND f.userAddresserID = $1) 
                                OR (post.userID = f.userAddresserID AND f.userAddresseeID = $2)
            WHERE 
                ((post.postPrivacyID = 3) OR 
                (post.postPrivacyID = 2 AND (f.statusID = 'a' OR $3 = 'm' OR post.userID = $4)) OR 
                (post.postPrivacyID = 1 AND (post.userID = $5 OR $6 = 'm')))
        `;

        console.log("user", userID);

        const queryParams = [currentUser, currentUser, userRole, currentUser, currentUser, userRole];

        if (!searchTerm.length) {
            if (categoryID) {
                query += ' AND post.postCASCategoryID = $' + (queryParams.length + 1);
                queryParams.push(categoryID);
            }
            if (monthID) {
                query += ' AND post.postMonthID = $' + (queryParams.length + 1);
                queryParams.push(monthID);
            }
            if (privacyID) {
                query += ' AND post.postPrivacyID = $' + (queryParams.length + 1);
                queryParams.push(privacyID);
            }
            if (userID) {
                query += ' AND post.userID = $' + (queryParams.length + 1);
                queryParams.push(userID);
            }
            if (postID) {
                query += ' AND post.postID = $' + (queryParams.length + 1);
                queryParams.push(postID);
            }
            query += ' ORDER BY post.postDate DESC';
        } else {
            const searchTerms = searchTerm.split(',').map(term => term.trim()).filter(term => term.length > 0);

            if (!searchTerms.length) {
                return res.status(400).json({ success: false, message: 'No valid search terms provided' });
            }

            const conditions = [];
            searchTerms.forEach((term, index) => {
                conditions.push(`(post.postText ILIKE $${queryParams.length + 1} OR userProfile.userFullName ILIKE $${queryParams.length + 2})`);
                queryParams.push(`%${term}%`, `%${term}%`);
            });

            if (conditions.length) {
                query += ' AND ' + conditions.join(' AND ');
            }

            if (categoryID) {
                query += ' AND post.postCASCategoryID = $' + (queryParams.length + 1);
                queryParams.push(categoryID);
            }
            if (monthID) {
                query += ' AND post.postMonthID = $' + (queryParams.length + 1);
                queryParams.push(monthID);
            }
            if (privacyID) {
                query += ' AND post.postPrivacyID = $' + (queryParams.length + 1);
                queryParams.push(privacyID);
            }
            if (userID) {
                query += ' AND post.userID = $' + (queryParams.length + 1);
                queryParams.push(userID);
            }

            query += ' ORDER BY post.postDate DESC';
        }

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
        const userID = req.query.userID;

        if (!searchTerm) {
            return res.status(400).json({ success: false, message: 'Search term is required' });
        }

        if (!userID) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        const query = `
            SELECT 
                userProfile.userID, 
                userProfile.userFullName, 
                userProfile.schoolID, 
                userProfile.userGraduationYear,
                school.schoolFullName
            FROM 
                userProfile
            LEFT JOIN 
                school ON userProfile.schoolID = school.schoolID
            WHERE 
                (LOWER(userProfile.userFullName) ILIKE $1 OR LOWER(school.schoolFullName) ILIKE $2)
                AND userProfile.userID != $3;
        `;

        const result = await client.query(query, [searchTerm, searchTerm, userID]);
        
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
        const { postID } = req.query;

        if (!postID) {
            return res.status(400).json({ success: false, message: 'Post ID is required' });
        }

        // Fetch comments with user roles
        const commentQuery = `
            SELECT c.commentID, c.postID, c.commentDate, c.commentText, c.commentingUserID, u.userFullName, u.userRole
            FROM comments c
            JOIN userProfile u ON c.commentingUserID = u.userID
            WHERE c.postID = $1
            ORDER BY 
                CASE WHEN u.userRole = 'm' THEN 0 ELSE 1 END, 
                c.commentDate DESC
        `;

        const { rows: comments } = await client.query(commentQuery, [postID]);

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
        const { postID, commentText } = req.body;
        const commentingUserID = req.session.userID; // Assuming user is authenticated

        if (!postID || !commentText || !commentingUserID) {
            return res.status(400).json({ success: false, message: 'Post ID, comment text, and user ID are required' });
        }

        const commentDate = new Date().toISOString(); // Get the current date and time in ISO format

        const query = `
            INSERT INTO comments (postID, commentDate, commentText, commentingUserID) 
            VALUES ($1, $2, $3, $4) RETURNING commentID
        `;

        const { rows } = await client.query(query, [postID, commentDate, commentText, commentingUserID]);

        res.json({ success: true, commentID: rows[0].commentID });

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
        const { postID } = req.body;
        const userID = req.session.userID; // Assuming user is authenticated

        if (!postID || !userID) {
            return res.status(400).json({ success: false, message: 'Post ID and user ID are required' });
        }

        const query = `
            INSERT INTO likes (postID, userID) 
            VALUES ($1, $2) 
            ON CONFLICT (postID, userID) DO NOTHING
        `;

        await client.query(query, [postID, userID]);

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
        const { postID } = req.query;

        if (!postID) {
            return res.status(400).json({ success: false, message: 'Post ID is required' });
        }

        const query = `
            SELECT COUNT(*) AS totalLikes
            FROM likes
            WHERE postID = $1
        `;

        const { rows } = await client.query(query, [postID]);

        res.json({ totalLikes: parseInt(rows[0].totalLikes) });

    } catch (err) {
        console.error('Error fetching likes:', err.message);
        res.status(500).json({ success: false, message: 'Database error' });
    } finally {
        client.release();
    }
});


// DELETING COMMENTS
app.delete('/comments/:commentID', async (req, res) => {
    const client = await pool.connect();
    try {
        const commentID = req.params.commentID;
        const userID = req.session.userID; // Assuming user is authenticated

        if (!commentID || !userID) {
            return res.status(400).json({ success: false, message: 'Comment ID and user ID are required' });
        }

        // Get user role and comment author
        const userQuery = `
            SELECT u.userRole, c.commentingUserID 
            FROM userProfile u
            LEFT JOIN comments c ON c.commentID = $1
            WHERE u.userID = $2
        `;

        const { rows } = await client.query(userQuery, [commentID, userID]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User or comment not found' });
        }

        const { userRole, commentingUserID } = rows[0];

        // Allow deletion for admins (`'m'`) or the comment's author
        if (userRole === 'm' || commentingUserID === userID) {
            const deleteQuery = `DELETE FROM comments WHERE commentID = $1`;
            await client.query(deleteQuery, [commentID]);

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
        const userID = req.session.userID; // Assuming user is authenticated

        if (!userID) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const query = 'SELECT userRole FROM userProfile WHERE userID = $1';
        const { rows } = await client.query(query, [userID]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ role: rows[0].userRole, userID });

    } catch (err) {
        console.error('Error fetching user role:', err.message);
        res.status(500).json({ success: false, message: 'Database error' });
    } finally {
        client.release();
    }
});




// DELETING POSTS
app.delete('/posts/:postID', async (req, res) => {
    const client = await pool.connect();
    try {
        const postID = req.params.postID;
        const userID = req.session.userID; // Assuming user is authenticated

        if (!postID || !userID) {
            return res.status(400).json({ success: false, message: 'Post ID and user ID are required' });
        }

        console.log('Session userID:', userID);

        // Fetch user role and post author in a single query
        const userQuery = `
            SELECT u.userRole, p.userID AS postAuthor 
            FROM userProfile u
            LEFT JOIN post p ON p.postID = $1
            WHERE u.userID = $2
        `;

        const { rows } = await client.query(userQuery, [postID, userID]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User or post not found' });
        }

        const { userRole, postAuthor } = rows[0];

        if (userRole === 'm' || postAuthor === userID) {
            // Delete comments first, then the post (maintain referential integrity)
            await client.query('DELETE FROM comments WHERE postID = $1', [postID]);
            await client.query('DELETE FROM post WHERE postID = $1', [postID]);

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
app.get('/user-info/:userID', async (req, res) => {
    const client = await pool.connect();
    try {
        const userID = req.params.userID;

        if (!userID) {
            console.error('User ID not provided');
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        const query = `
            SELECT u.userID, u.userFullName, u.userGraduationYear, s.schoolFullName
            FROM userProfile u
            INNER JOIN school s ON u.schoolID = s.schoolID
            WHERE u.userID = $1
        `;

        const { rows } = await client.query(query, [userID]);

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



app.get('/user-statistics/:userID', async (req, res) => {
    const client = await pool.connect();
    try {
        const userID = req.params.userID;

        const totalPostsQuery = 'SELECT COUNT(*) AS "totalPosts" FROM post WHERE userID = $1';

        const postsByCategoryQuery = `
            SELECT postCASCategoryID, COUNT(*) AS count
            FROM post
            WHERE userID = $1
            GROUP BY postCASCategoryID
        `;

        const totalPostsResult = await client.query(totalPostsQuery, [userID]);
        const postsByCategoryResult = await client.query(postsByCategoryQuery, [userID]);

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
        const { userAddresserID, userAddresseeID } = req.body;

        const query = `
            INSERT INTO friends (userAddresserID, userAddresseeID, statusID)
            VALUES ($1, $2, 'p')
        `;

        await client.query(query, [userAddresserID, userAddresseeID]);

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
        const { userAddresserID, userAddresseeID } = req.query;

        if (!userAddresserID || !userAddresseeID) {
            return res.status(400).json({ error: 'Both userAddresserID and userAddresseeID are required' });
        }

        const query = `
            SELECT statusID, userAddresserID, userAddresseeID
            FROM friends
            WHERE (userAddresserID = $1 AND userAddresseeID = $2)
               OR (userAddresserID = $2 AND userAddresseeID = $1)
        `;

        const { rows } = await client.query(query, [userAddresserID, userAddresseeID]);

        if (rows.length > 0) {
            res.json({ status: rows[0].statusid, userAddresserID: rows[0].useraddresserid, userAddresseeID: rows[0].useraddresseeid });
        } else {
            res.json({ status: 'd', userAddresserID, userAddresseeID });
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
        const { userAddresserID, userAddresseeID, action } = req.body;

        if (!userAddresserID || !userAddresseeID || !['accept', 'decline'].includes(action)) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        if (action === 'decline') {
            const deleteQuery = `
                DELETE FROM friends
                WHERE (userAddresserID = $1 AND userAddresseeID = $2)
                   OR (userAddresserID = $2 AND userAddresseeID = $1)
            `;
            const result = await client.query(deleteQuery, [userAddresserID, userAddresseeID]);
            return res.json({ message: result.rowCount > 0 ? 'Friend request declined' : 'No request found' });
        }

        // Accept the friend request
        const updateQuery = `
            UPDATE friends
            SET statusID = 'a'
            WHERE (userAddresserID = $1 AND userAddresseeID = $2)
               OR (userAddresserID = $2 AND userAddresseeID = $1)
        `;
        const updateResult = await client.query(updateQuery, [userAddresserID, userAddresseeID]);

        res.json({ message: updateResult.rowCount > 0 ? 'Friend request accepted' : 'No request found' });

    } catch (err) {
        console.error('Error responding to friend request:', err);
        res.status(500).json({ error: 'Database error' });
    } finally {
        client.release();
    }
});



// Endpoint to get the three latest friends
// Updated endpoint to get the three latest friends with their names and IDs
app.get('/api/friends/latest/:userID', async (req, res) => {
    const client = await pool.connect();
    try {
        const { userID } = req.params;

        const query = `
            SELECT u.userID, u.userFullName
            FROM friends f
            JOIN userProfile u ON u.userID = 
                CASE WHEN f.userAddresserID = $1 THEN f.userAddresseeID ELSE f.userAddresserID END
            WHERE (f.userAddresserID = $1 OR f.userAddresseeID = $1)
            AND f.statusID = 'a'
            ORDER BY f.friendshipID DESC
            LIMIT 3
        `;

        const { rows } = await client.query(query, [userID]);
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
        const { userID, notificationType, actorID, postID } = req.body;

        if (!userID || !notificationType) {
            return res.status(400).json({ error: 'userID and notificationType are required' });
        }

        if (userID === actorID) {
            return res.status(200).json({ message: 'No notification created: userID and actorID are the same' });
        }

        const query = `
            INSERT INTO notifications (userID, notificationType, actorID, postID)
            VALUES ($1, $2, $3, $4)
        `;

        await client.query(query, [userID, notificationType, actorID, postID]);

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
    const { userID } = req.query;

    if (!userID) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        const { rows } = await pool.query(`
            SELECT n.*, u.userFullName
            FROM notifications n
            JOIN userProfile u ON n.actorID = u.userID
            WHERE n.userID = $1 
            ORDER BY n.notificationTime DESC;
        `, [userID]);

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});




app.get('/api/getPostOwnerID', async (req, res) => {
    const { postID } = req.query;

    if (!postID) {
        return res.status(400).json({ error: 'postID is required' });
    }

    try {
        const { rows } = await pool.query('SELECT userID FROM post WHERE postID = $1', [postID]);

        if (rows.length > 0) {
            res.status(200).json({ userID: rows[0].userID });
        } else {
            res.status(404).json({ error: 'Post not found' });
        }
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});





app.post('/change-password', async (req, res) => {
    const { userID, oldPassword, newPassword } = req.body;

    if (!userID || !oldPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    try {
        // Start transaction
        await pool.query('BEGIN');

        // Get stored password hash
        const { rows } = await pool.query('SELECT userPasswordHash FROM userProfile WHERE userID = $1', [userID]);

        if (rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const storedHash = rows[0].userPasswordHash;

        // Compare old password with stored hash
        const match = await bcrypt.compare(oldPassword, storedHash);
        if (!match) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Incorrect old password' });
        }

        // Hash the new password
        const newHashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the password
        await pool.query('UPDATE userProfile SET userPasswordHash = $1 WHERE userID = $2', [newHashedPassword, userID]);

        // Commit transaction
        await pool.query('COMMIT');

        res.status(200).json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error changing password:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


