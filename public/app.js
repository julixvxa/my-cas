
// GETTING USER id FROM SESSION
async function getuserid() {
    try {
        const response = await fetch('/session-userid');
        if (!response.ok) throw new Error('Failed to fetch user id');

        const result = await response.json();
        if (result.success) return result.userid;
        else throw new Error('User not found');
    } catch (error) {
        console.error('Error fetching user id:', error);
        return null; // Return null in case of error
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Check if the user is logged in
    const userid = await getuserid(); // or similar function to check login status

    if (userid) {
        // User is logged in, show the feed panel
        showFeed();
    } else {
        // User is not logged in, show the login panel
        showLogin();
    }
});



// EVENT LISTENERS
document.addEventListener('DOMContentLoaded', () => {

    // Handle form submissions
    document.getElementById('register-form').addEventListener('submit', handleRegistration);
    document.getElementById('signup-form').addEventListener('submit', handleSignUp);
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('post-form').addEventListener('submit', handlePostCreation);


    document.getElementById('logout-button').addEventListener('click', logout);

    document.getElementById('search-button').addEventListener('click', () => {
        search(null, false); // Main feed search without userid
    });

    document.getElementById('search-button-my-info').addEventListener('click', async () => {
        try {
            const userid = await getuserid();
            search(userid, false); // Search for logged-in user's posts
            console.log('search wywolane');
        } catch (error) {
            console.error('Error fetching user id from profile:', error);
        }
    });

    document.getElementById('search-clear-all').addEventListener('click', () => {
        clearSearchFields(false, false);
        loadPost(); // Reload all posts for main feed
        const resultsContainer = document.getElementById('search-results');
        resultsContainer.innerHTML = ''; // Clear previous results
    });

    document.getElementById('search-clear-all-my-info').addEventListener('click', async () => {
        try {
            const userid = await getuserid();
            clearSearchFields(true, false);
            loadPost(null, userid, false); // Reload posts for logged-in user
            const resultsContainer = document.getElementById('search-results');
            resultsContainer.innerHTML = ''; // Clear previous results
        } catch (error) {
            console.error('Error fetching user id or performing search:', error);
        }
    });
    
    getCurrentView();
    //showLogin();
});


// CLEARING SEARCH FIELDS
function clearSearchFields(myInfo = false, otherInfo=false) {
    let prefix;
    let suffix;
    if (myInfo === false && otherInfo === false){
        prefix = '';
        suffix = '';
    } else if (myInfo === true && otherInfo === false){
        prefix = '-my-info';
        suffix = '';
    } else if (myInfo === false && otherInfo === true){
        prefix = '-my-info';
        suffix = 'other-';
    }
    document.getElementById(`${suffix}search-bar${prefix}`).value = '';
    document.getElementById(`${suffix}search-category${prefix}`).value = '';
    document.getElementById(`${suffix}search-month${prefix}`).value = '';
    document.getElementById(`${suffix}search-privacy${prefix}`).value = '';
}

async function search(userid = null, other = false) {
    try {
        let prefix;
        let suffix;
        if (!userid && (other === false)){ // main feed
            prefix = '';
            suffix = '';
        } else if (userid && (other === false)){ // my info
            prefix = '-my-info';
            suffix = '';
        } else if (other === true){ // others info
            prefix = '-my-info';
            suffix = 'other-';
        }
        
        const searchTerm = document.getElementById(`${suffix}search-bar${prefix}`).value;
        const category = document.getElementById(`${suffix}search-category${prefix}`).value;
        const month = document.getElementById(`${suffix}search-month${prefix}`).value;
        const privacy = document.getElementById(`${suffix}search-privacy${prefix}`).value;

        console.log('Search Term:', searchTerm);
        console.log('Category:', category);
        console.log('Month:', month);
        console.log('Privacy:', privacy);

        let searchResult;

        if (!userid && (other === false)) { //main feed
            searchResult = await searchPost(searchTerm, category, month, privacy, null, false, null);
            loadPost(searchResult);
            searchUser(searchTerm);
        } else if (userid && (other === false)){
            searchResult = await searchPost(searchTerm, category, month, privacy, userid, false);
            loadPost(searchResult, userid, false, false);
            console.log('Provided User id:', userid);
        } else if (other === true){
            searchResult = await searchPost(searchTerm, category, month, privacy, userid, true);
            loadPost(searchResult, userid, true, false);
            console.log('Provided User id:', userid);
        }

    } catch (error) {
        console.error('Error in search function:', error);
    }
}

document.getElementById('search-clear-all-my-info').addEventListener('click', async () => {
    try {
        // Fetch userid asynchronously
        const userid = await getuserid();
        
        // Clear search input fields
        document.getElementById('search-bar-my-info').value = '';
        document.getElementById('search-category-my-info').value = '';
        document.getElementById('search-month-my-info').value = '';
        document.getElementById(`search-privacy-my-info`).value = '';
        
        // Reload posts (or perform the desired action)
        loadPost(null, userid);
    } catch (error) {
        console.error('Error fetching user id or performing search:', error);
    }
});

// GETTING CURRENT VIEW
function getCurrentView() {
    if (document.getElementById('user-info-panel').style.display === 'block') {
        return 'user-info';
    } else if (document.getElementById('feed-panel').style.display === 'block') {
        return 'feed';
    } else if (document.getElementById('other-user-info-panel').style.display === 'block'){
        return 'other-user-info';
    } else if (document.getElementById('notification-panel').style.display === 'block'){
        return 'notifications';
    }
    return 'unknown';
}

function convertUTCToLocal(dateString) {
    if (!dateString || typeof dateString !== 'string') {
        console.error('Invalid date string:', dateString);
        return 'Invalid Date';
    }

    let date;
    try {
        if (dateString.includes('T')) {
            date = new Date(dateString); // ISO 8601 format
        } else {
            date = new Date(dateString.replace(' ', 'T') + 'Z'); // Convert to ISO format (assuming UTC)
        }
    } catch (error) {
        console.error('Error parsing date:', error, 'Original string:', dateString);
        return 'Invalid Date';
    }

    if (isNaN(date.getTime())) { // Check if the date is valid
        console.error('Invalid date:', dateString);
        return 'Invalid Date';
    }

    return date.toLocaleString(); // Convert to local time
}


// Function to show the custom alert modal
function showCustomAlert(message) {
    const modal = document.getElementById('customAlert');
    const alertMessage = document.getElementById('alertMessage');
    alertMessage.innerText = message; // Set the message dynamically
    modal.style.display = 'flex'; // Show the modal
  }
  
  // Function to close the custom alert modal
  function closeCustomAlert() {
    const modal = document.getElementById('customAlert');
    modal.style.display = 'none'; // Hide the modal
  }
  
  // Attach close button event listener
  document.getElementById('closeAlert').addEventListener('click', closeCustomAlert);

  
// Function to show a popup message
function displayPopupMessage(message, type = 'success') {
    const popupArea = document.getElementById('popup-area');
  
    // Create a popup message element
    const popupElement = document.createElement('div');
    popupElement.classList.add('popup-message');
    
    // Apply type-based background colors
    if (type === 'error') {
      popupElement.style.backgroundColor = '#F44336';
    } else if (type === 'info') {
      popupElement.style.backgroundColor = '#2196F3';
    } else {
      popupElement.style.backgroundColor = '#4CAF50';
    }
  
    popupElement.innerText = message;
    popupArea.appendChild(popupElement);
  
    // Keep popup visible for 8 seconds, then start fade-out
    setTimeout(() => {
      popupElement.style.animation = 'fadeOut 1s ease forwards';
    }, 8000); // Delay before starting fade-out
  
    // Remove popup from DOM only after fade-out completes
    setTimeout(() => {
      popupArea.removeChild(popupElement);
    }, 9000); // 8 seconds + 1 second fade-out
  }
  
  



  function validateInput(email = null, fullName = null, password = null) {
    const errors = [];

    // Validate email only if provided
    if (email !== null) {
        const emailRegex = /^(?=.*@)(?=.*\.).{5,}$/;
        if (!emailRegex.test(email)) {
            errors.push('Invalid email: must contain "@" and ".", and at least 3 characters apart from them.');
        }
    }

    // Validate full name only if provided
    let normalizedFullName = fullName;
    if (fullName !== null) {
        const fullNameRegex = /^[a-zA-ZÀ-ÖØ-öø-ÿ]+([ '-][a-zA-ZÀ-ÖØ-öø-ÿ]+)*$/;
        if (!fullNameRegex.test(fullName)) {
            errors.push('Invalid full name: only alphabetic characters, hyphens, apostrophes, and spaces are allowed.');
        } else {
            // Normalize full name to Title Case
            normalizedFullName = fullName
                .toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }
    }

    // Validate password only if provided
    if (password !== null) {
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        if (!passwordRegex.test(password)) {
            errors.push('Invalid password: must be at least 8 characters, include one uppercase letter, one lowercase letter, one digit, and one special character.');
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        normalizedFullName
    };
}


// Function to toggle password visibility for the login, signup, and register forms
function togglePasswordVisibility() {
    // Get all checkboxes with the class 'show-password'
    const checkboxes = document.querySelectorAll('.show-password');
    
    // Loop through each checkbox and toggle the associated password visibility
    checkboxes.forEach(checkbox => {
        // Derive the password field id by replacing 'show-' with 'password-'
        const passwordFieldId = checkbox.id.replace('show-', ''); // Match the form-specific password field id
        const passwordField = document.querySelector(`#${passwordFieldId}`); // Find the corresponding password field
        
        // Log to help debug
        console.log(`Checkbox id: ${checkbox.id}`);
        console.log(`Password field id: ${passwordFieldId}`);
        
        // Check if password field exists and toggle visibility
        if (passwordField) {
            passwordField.type = checkbox.checked ? 'text' : 'password';
            console.log(`Password type set to: ${passwordField.type}`);
        } else {
            console.error(`Password field not found for id: ${passwordFieldId}`);
        }
    });
}

// Add event listeners to all checkboxes with the class 'show-password'
document.querySelectorAll('.show-password').forEach(checkbox => {
    checkbox.addEventListener('change', togglePasswordVisibility);
});


// REGISTRATION
async function handleRegistration(event) {
    event.preventDefault();

    const schoolfullname = document.getElementById('register-school').value;
    const email = document.getElementById('register-email').value;
    const userfullname = document.getElementById('register-fullname').value;
    const password = document.getElementById('register-password').value;
    const repeatPassword = document.getElementById('register-repeat-password').value;
    const errorMessage = document.getElementById('errorMessage');

    if (password !== repeatPassword) {
        errorMessage.textContent = 'Passwords do not match!';
        showCustomAlert('Passwords do not match. Please ensure both passwords match.');
        document.getElementById('register-password').value = '';
        document.getElementById('register-repeat-password').value = '';
        return;
    }

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schoolfullname, email, userfullname, password })
        });

        if (!response.ok) {
            throw new Error('Network response not ok');
        }

        const result = await response.json();
        if (result.success) {
            displayPopupMessage('Registered successfully');
            showLogin();
        } else {
            showCustomAlert(result.message || 'Failed to register. Please try again.');
        }
    } catch (error) {
        console.error('Error during registration:', error);
        showCustomAlert('An error occurred while processing registration. Please try again later.');
    }
}


// SIGN UP
async function handleSignUp(event) {
    event.preventDefault();

    const email = document.getElementById('signup-email').value;
    const fullName = document.getElementById('signup-fullname').value;
    const password = document.getElementById('signup-password').value;
    const repeatPassword = document.getElementById('signup-repeat-password').value;
    const school = document.getElementById('signup-school').value;
    const year = document.getElementById('signup-year').value;
    const errorMessage = document.getElementById('errorMessage');

    // Validate inputs
    const { isValid, errors, normalizedFullName } = validateInput(email, fullName, password);

    if (!isValid) {
        errorMessage.textContent = errors.join(' ');
        showCustomAlert(errors.join(' '));
        return;
    }

    if (password !== repeatPassword) {
        errorMessage.textContent = 'Passwords do not match!';
        showCustomAlert('Passwords do not match. Please ensure both passwords match.');
        return;
    }

    try {
        const response = await fetch('/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, fullName: normalizedFullName, password, school, year })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        if (result.success) {
            displayPopupMessage('Signed up successfully');
            showLogin();
        } else {
            showCustomAlert(result.message || 'Sign-up failed. Please try again.');
        }
    } catch (error) {
        console.error('Error during sign-up:', error);
        showCustomAlert('An error occurred while processing sign-up. Please try again later.');
    }
}



// LOGIN
async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json(); // Parse server response regardless of the HTTP status code

        if (response.status === 200) {
            // Successful login
            displayPopupMessage('Logged in successfully');
            showFeed();
            loadPost();
        } else if (response.status === 401) {
            // Incorrect password or email
            showCustomAlert('The password you entered is incorrect. Please try again.');
        } else if (response.status === 404) {
            // User not found
            showCustomAlert('No account found with this email. Please register.');
        } else {
            // Handle other server errors
            console.error('Unexpected server response', result);
            showCustomAlert('An unexpected error occurred. Please try again later.');
        }
    } catch (error) {
        console.error('Error logging in:', error);
        showCustomAlert('An error occurred during login. Please try again later.');
    }
}





// JavaScript: Logout Function
async function logout() {
    try {
        const response = await fetch('/logout', { method: 'POST' });

        if (!response.ok) {
            throw new Error('Failed to log out');
        }

        localStorage.removeItem('userid');
        displayPopupMessage('Logged out successfully');
        showLogin();
    } catch (error) {
        console.error('Error logging out:', error);
        showCustomAlert('Failed to log out. Please try again later.');
    }
}


// FETCHING CAS
async function fetchCategoryName(categoryid) {
    const categoryMap = {
        1: 'Creativity',
        2: 'Activity',
        3: 'Service'
    };
    return categoryMap[categoryid] || 'Unknown';
}

// FETCHING MONTHS
async function fetchMonthName(monthid) {
    const monthMap = {
        1: 'January',
        2: 'February',
        3: 'March',
        4: 'April',
        5: 'May',
        6: 'June',
        7: 'July',
        8: 'August',
        9: 'September',
        10: 'October',
        11: 'November',
        12: 'December'
    };
    return monthMap[monthid] || 'Unknown';
}

async function fetchPrivacyLevel(postprivacyid) {
    const privacyMap = {
        '1': 'Me and Moderator Only',
        '2': 'Me and Friends',
        '3': 'Public'
    };
    return privacyMap[postprivacyid] || 'Unknown Privacy Level';
}

// FETCHING FULL NAME
async function fetchuserfullname(userid) {
    try {
        const response = await fetch(`/user/${userid}`);
        if (!response.ok) {
            throw new Error('Failed to fetch user full name');
        }
        const result = await response.json();
        if (result.success) {
            return result.userfullname;
        } else {
            throw new Error('User not found');
        }
    } catch (error) {
        console.error('Error fetching user full name:', error);
        return 'Unknown User';
    }
}

// CREATING POSTS
async function handlePostCreation(event) {
    event.preventDefault();

    const posttext = document.getElementById('post-text').value;
    const postcategory = document.getElementById('post-category').value;
    const postmonth = document.getElementById('post-month').value;
    const postprivacy = document.getElementById('post-privacy').value;  // Get the selected privacy level
    const mediafiles = document.getElementById('post-media').files;

    const formData = new FormData();
    formData.append('text', posttext);
    formData.append('category', postcategory);
    formData.append('month', postmonth);
    formData.append('privacy', postprivacy);  // Include privacy level in the form data
    for (const file of mediafiles) {
        formData.append('media', file);
    }

    try {
        const response = await fetch('/post', {
            method: 'POST',
            body: formData
        });

        // Check if the response was successful
        if (!response.ok) {
            const errorResponse = await response.json();
            if (errorResponse.message) {
                throw new Error(errorResponse.message);  // Propagate error from server
            } else {
                throw new Error('Network response was not ok');
            }
        }

        const result = await response.json();
        if (result.success) {
            showCustomAlert('Post created successfully');
            document.getElementById('post-form').reset(); // Reset form
            console.log('Post created');
            document.getElementById('search-bar').value = '';
            document.getElementById('search-category').value = '';
            document.getElementById('search-month').value = '';
            loadPost();
            showFeed(); // Show the feed after post creation
        } else {
            showCustomAlert('Failed to create post');
        }
    } catch (error) {
        console.error('Error creating post:', error);
        showCustomAlert(`An error occurred while creating the post: ${error.message}`);
    }
}

// COMMENT SUBMISSIONS
async function handleCommentSubmission(event, postid, postsowneruserid) {
    event.preventDefault();
    const view = getCurrentView();

    let userid;
    try {
        userid = await getuserid(); // Await the result of the async function
    } catch (error) {
        console.error('Error fetching user id:', error);
        userid = 'Unknown User'; // Handle error by providing a default or unknown user id
    }

    const form = event.target;
    const commenttext = form.commenttext.value;

    try {
        const response = await fetch('/add-comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postid, commenttext })
        });

        const result = await response.json();

        if (result.success) {
            console.log('Comment submitted successfully');
            // Send notification
            const notificationResponse = await fetch('/api/sendNotifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userid: postsowneruserid,
                    notificationtype: 'Comment',
                    actorid: userid,
                    postid: postid
                }),
            });

            if (notificationResponse.ok) {
                console.log('Notification created successfully');
            } else {
                console.error('Failed to create notification');
            }

            // Reload posts to reflect the new comment
            if (view === 'user-info') {
                console.log('Reloading posts for user-info view');
                loadPost(null, userid, false); // Reload posts for the user's profile
            } else if (view === 'other-user-info'){
                loadPost(null, postsowneruserid, true)
            } else if (view === 'feed') {
                console.log('Reloading posts for feed view');
                loadPost(); // Reload posts for the feed view
            } else if (view === 'notifications'){
                loadPost(await searchPost('', '', '', '', null, false, postid), null, false, true);
            }
        } else {
            console.error('Failed to submit comment:', result.message);
        }
    } catch (error) {
        console.error('Error submitting comment:', error);
    }
}

async function getPostOwnerid(postid) {
    try {
        const response = await fetch(`/api/getPostOwnerid?postid=${postid}`);
        if (response.ok) {
            const data = await response.json();
            return data.userid;
        } else {
            console.error('Failed to get post owner id:', response.statusText);
            return null;
        }
    } catch (error) {
        console.error('Error fetching post owner id:', error);
        return null;
    }
}


// LIKING POSTS
async function likePost(postid) {
    const view = getCurrentView();

    let userid;
    try {
        userid = await getuserid(); // Await the result of the async function
    } catch (error) {
        console.error('Error fetching user id:', error);
        userid = 'Unknown User'; // Handle error by providing a default or unknown user id
    }

    const postownerid = await getPostOwnerid(postid);

    try {
        const response = await fetch('/like', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ postid })
        });

        if (response.ok) {
            // Send notification
            const notificationResponse = await fetch('/api/sendNotifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userid: postownerid,
                    notificationtype: 'Like',
                    actorid: userid,
                    postid: postid
                }),
            });

            if (notificationResponse.ok) {
                console.log('Notification created successfully');
            } else {
                console.error('Failed to create notification');
            }

            const result = await response.json();
            if (result.success) {
                if (view === 'user-info'){
                    console.log(view);
                    loadPost(null, userid);
                } else if (view === 'other-user-info'){
                        loadPost(null, postownerid, true)
                } else if (view === 'feed'){
                    console.log(view);
                    loadPost();
                } else if (view === 'notifications'){
                    loadPost(await searchPost('', '', '', '', null, false, postid), null, false, true);
                }
            } else {
                console.error('Failed to like the post:', result.message);
            }
        }
    } catch (error) {
        console.error('Error liking the post:', error);
    }
}


// DELETING POSTS
async function deletePost(postid, postsowneruserid=null) {
    const view = getCurrentView();
    console.log(postsowneruserid);


    let userid;
    try {
        userid = await getuserid();
    } catch (error) {
        console.error('Error fetching user id:', error);
        userid = 'Unknown User';
    }

    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
        const response = await fetch(`/posts/${postid}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (result.success) {
            // Reload or update posts based on the current view
            if (view === 'user-info') {
                console.log('Reloading posts for user-info view');
                loadPost(null, userid, false); // Reload posts for the user's profile
            } else if (view === 'other-user-info'){
                loadPost(null, postsowneruserid, true)
            } else if (view === 'feed') {
                console.log('Reloading posts for feed view');
                loadPost(); // Reload posts for the feed view
            } else if (view === 'notifications'){
                loadPost(await searchPost('', '', '', '', null, false, postid), null, false, true);
            }
        } else {
            console.error('Failed to delete the post:', result.message);
        }
    } catch (error) {
        console.error('Error deleting the post:', error);
    }
}


// DELETING COMMENTS
async function deleteComment(commentid, postsOwneruserid, postid) {
    const view = getCurrentView();

    let userid;
    try {
        userid = await getuserid();
    } catch (error) {
        console.error('Error fetching user id:', error);
        userid = 'Unknown User';
    }

    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
        const response = await fetch(`/comments/${commentid}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (result.success) {
            // Reload or update posts based on the current view
            if (view === 'user-info') {
                console.log('Reloading posts for user-info view');
                loadPost(null, userid, false); // Reload posts for the user's profile
            } else if (view === 'other-user-info'){
                loadPost(null, postsOwneruserid, true)
            } else if (view === 'feed') {
                console.log('Reloading posts for feed view');
                loadPost(); // Reload posts for the feed view
            } else if (view === 'notifications'){
                loadPost(await searchPost('', '', '', '', null, false, postid), null, false, true);
            }
        } else {
            console.error('Failed to delete the comment:', result.message);
        }
    } catch (error) {
        console.error('Error deleting the comment:', error);
    }
}

let currentSlideIndex = {}; // Track current slide for each carousel

// Change the slide (next or previous)
function changeSlide(direction, carouselId) {
  const carousel = document.querySelector(`#${carouselId}`);
  const carouselItems = carousel.querySelectorAll('.carousel-item');
  const totalSlides = carouselItems.length;

  // Initialize index if not set
  if (!currentSlideIndex[carouselId]) {
    currentSlideIndex[carouselId] = 0;
  }

  // Hide current slide
  carouselItems[currentSlideIndex[carouselId]].style.display = 'none';

  // Update index and wrap around
  currentSlideIndex[carouselId] = (currentSlideIndex[carouselId] + direction + totalSlides) % totalSlides;

  // Show next slide
  carouselItems[currentSlideIndex[carouselId]].style.display = 'block';
}






async function loadPost(postsData = null, userid = null, other = false, notification = false) {
    try {
        const userRoleResponse = await fetch('/userRole');
        const userRoleData = await userRoleResponse.json();
        const userRole = userRoleData.role;
        const currentUser = await getuserid();

        const posts = postsData || await (await fetch(userid ? `/postload?userid=${userid}&userRole=${userRole}&currentUser=${currentUser}` : `/postload?userRole=${userRole}&currentUser=${currentUser}`)).json();

        if (!Array.isArray(posts)) {
            console.error('Posts data is not an array:', posts);
            return [];
        }

        let postsContainer;
        if (!userid) {
            postsContainer = notification ? document.getElementById('notification-post') : document.getElementById('posts-container');
        } else {
            postsContainer = other ? document.getElementById('other-my-info-container') : document.getElementById('my-info-container');
        }

        if (!postsContainer) {
            console.error('Posts container element not found');
            return [];
        }

        if (posts.length === 0) {
            postsContainer.innerHTML = '<p>No posts available.</p>';
            return [];
        }

        const mediaPromises = posts.map(post => fetch(`/media/${post.postid}`).then(res => res.ok ? res.json() : []));
        const commentsPromises = posts.map(post => fetch(`/comments?postid=${post.postid}`).then(res => res.ok ? res.json() : []));
        const likesPromises = posts.map(post => fetch(`/like-count?postid=${post.postid}`).then(res => res.ok ? res.json() : { totallikes: 0 }));

        const [mediaArray, commentsArray, likesArray] = await Promise.all([Promise.all(mediaPromises), Promise.all(commentsPromises), Promise.all(likesPromises)]);

        console.log('Comments API Response:', commentsArray); // Debugging step

        const postElements = await Promise.all(posts.map(async (post, index) => {
            const postElement = document.createElement('div');
            postElement.classList.add('post-card'); // Applying post-card style

            const media = mediaArray[index];
            const comments = commentsArray[index];
            const likes = likesArray[index].totallikes;
            const userfullname = await fetchuserfullname(post.userid);

            let userfullnameLink;
            if (userid === currentUser) {
                userfullnameLink = `<a href="#" onclick="showUserInfo('${post.userid}')">${userfullname}</a>`;
            } else {
                userfullnameLink = `<a href="#" onclick="showOtherUserInfo('${post.userid}')">${userfullname}</a>`;
            }

            const canDeletePost = userRole === 'm' || (userRole === 's' && post.userid === userRoleData.userid);

            const categoryName = await fetchCategoryName(post.postcascategoryid);
            const monthName = await fetchMonthName(post.postmonthid);
            const privacyLevel = await fetchPrivacyLevel(post.postprivacyid);

            console.log('Media for post', post.postid, media);

            postElement.innerHTML = `
                <div class="post-date">${convertUTCToLocal(post.postdate)}</div>
                <h3 class="post-card-title">${userfullnameLink}</h3>
                <div class="post-card-content">${post.posttext}</div>
                <span class="post-tag">${categoryName}</span>
                <div class="post-details">
                    <p>Month: ${monthName} | Privacy: ${privacyLevel}</p>
                </div>
                <div class="post-media">
                    ${media && media.length > 0 ? `
                        <div class="carousel-container" id="carousel-${post.postid}">
                        <div class="carousel">
                            <!-- Loop through media to create carousel items -->
                            ${media.map((m, index) => `
                            <div class="carousel-item" style="display: ${index === 0 ? 'block' : 'none'}">
                                <img src="/uploads/${m.mediaFile}" alt="Media" class="carousel-image"/>
                            </div>
                            `).join('')}
                        </div>
                        <button class="carousel-arrow left" onclick="changeSlide(-1, 'carousel-${post.postid}')">&#10094;</button>
                        <button class="carousel-arrow right" onclick="changeSlide(1, 'carousel-${post.postid}')">&#10095;</button>
                        </div>
                    ` : '<p>No media available.</p>'}
                </div>
                <div class="post-likes">Likes: ${likes}</div>
                <div class="post-comments">
                    <div class="comments-list" id="comments-${post.postid}">
                        ${comments.length > 0 ? comments.map(comment => 
                            `<div class="comment">
                                <div class="comment-author">${comment.userfullname}</div>
                                <div class="comment-text">${comment.commenttext}</div>
                                <div class="comment-date">${convertUTCToLocal(comment.commentdate)}</div>
                                ${userRole === 'm' || (userRole === 's' && comment.commentinguserid === userRoleData.userid) ? 
                                    `<button onclick="deleteComment('${comment.commentid}', '${post.userid}', '${post.postid}')">Delete Comment</button>` : ''}
                            </div>`
                        ).join('') : '<p>No comments yet.</p>'}
                    </div>
                    <form onsubmit="handleCommentSubmission(event, '${post.postid}', '${post.userid}')">
                        <textarea name="commenttext" placeholder="Write your comment here..." required></textarea>
                        <div class="centered-buttons">
                            <button id="comment-submit" type="submit">Submit Comment</button>
                        </div>
                    </form>
                </div>
                <div class="panel-actions">
                    <button onclick="likePost('${post.postid}')">Like</button>
                    ${canDeletePost ? `<button onclick="deletePost('${post.postid}', '${post.userid}')">Delete Post</button>` : ''}
                </div>
            `;

            console.log('Generated HTML for post', post.postid, postElement.innerHTML);



            return postElement;
        }));

        postsContainer.innerHTML = '';
        postElements.forEach(postElement => postsContainer.appendChild(postElement));

        return posts;

    } catch (error) {
        console.error('Error loading posts:', error);
        return [];
    }
}



// SEARCHING POSTS
async function searchPost(searchTerm = '', categoryid = '', monthid = '', privacyid = '', userid = null, other = false, postid = null) {
    
    const currentUser = await getuserid();
    const userRoleResponse = await fetch('/userRole');
    const userRoleData = await userRoleResponse.json();
    const userRole = userRoleData.role;
    
    try {
        console.log('userid:', userid); // Ensure userid is defined and passed correctly

        const queryParams = new URLSearchParams({
            search: encodeURIComponent(searchTerm),
            categoryid,
            monthid,
            postid,
            privacyid,
            userRole
        });

        if (userid) {
            queryParams.append('userid', userid);
        }

        const requestUrl = `/searchPosts?${queryParams.toString()}&currentUser=${currentUser}`;
        console.log('Request URL:', requestUrl); // Log full URL to ensure userid is included

        const response = await fetch(requestUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        console.log('Search response data:', data); // Log the data for debugging

        if (data.success && Array.isArray(data.posts)) {
            console.log('Posts data:', data.posts);
            return data.posts;
        } else {
            console.error('Invalid response format:', data);
            return [];
        }
    } catch (error) {
        console.error('Error searching posts:', error);
        return [];
    }
}






async function searchUser(searchTerm = '') {

    if (!searchTerm) {
        console.log('Search term is empty.');
        return; // Exit the function if search term is empty
    }

    const userid = await getuserid();


    try {
        // Send a request to the server with the search term
        const response = await fetch(`/searchUser?term=${encodeURIComponent(searchTerm)}&userid=${userid}`);
        if (!response.ok) {
            throw new Error('Failed to fetch search results');
        }

        // Parse the response JSON
        const data = await response.json();
        console.log('Search response data:', data); // Log the response data for debugging

        if (data.success && Array.isArray(data.users)) {
            // Display search results
            displaySearchResults(data.users);
        } else {
            console.error('Failed to fetch users or invalid data format');
            document.getElementById('search-results').innerHTML = '<p>No users found.</p>';
        }
    } catch (error) {
        console.error('Error searching for user:', error);
        document.getElementById('search-results').innerHTML = '<p>Error searching for users.</p>';
    }
}

// DISPLAY SEARCH RESULTS
function displaySearchResults(users) {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = ''; // Clear previous results

    if (users.length === 0) {
        resultsContainer.innerHTML = '<p>No users found.</p>';
        return;
    }

    // Create and append user elements to the results container
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.classList.add('user-result');
        userElement.innerHTML = `
            <p><strong>Name:</strong> ${user.userfullname}</p>
            <p><strong>School:</strong> ${user.schoolfullname}</p>
            <p><strong>Graduation Year:</strong> ${user.userGraduationYear}</p>
            <button onclick="showOtherUserInfo('${user.userid}')">View Profile</button>
        `;
        resultsContainer.appendChild(userElement);
    });
}

// Separate function to fetch and display latest friends
async function showLatestFriends(userid, currentUser) {
    const friendContainer = document.getElementById('latest-friends');
    friendContainer.innerHTML = ''; // Clear existing content

    const title = document.createElement('h3');
    title.textContent = "Latest Friends:";
    friendContainer.appendChild(title);

    try {
        const response = await fetch(`/api/friends/latest/${userid}`);
        const data = await response.json();
        console.log("Latest friends data:", data);

        if (data.success && data.friends.length > 0) {
            const ul = document.createElement('ul');

            data.friends.forEach(friend => {
                const li = document.createElement('li');
                const friendLink = document.createElement('a');
                friendLink.textContent = friend.userfullname;
                friendLink.href = '#';

                if (friend.userid === currentUser) {
                    friendLink.addEventListener('click', () => showUserInfo());
                } else {
                    friendLink.addEventListener('click', () => showOtherUserInfo(friend.userid));
                }

                li.appendChild(friendLink);
                ul.appendChild(li);
            });

            friendContainer.appendChild(ul);
        } else {
            friendContainer.innerHTML = '<p>No recent friends found.</p>';
        }
    } catch (error) {
        console.error('Error fetching latest friends:', error);
        friendContainer.innerHTML = '<p>Error loading friends.</p>';
    }
}

// VIEWING MY PROFILE
async function showUserInfo(userid = null) {
    hideAllPanels();
    document.getElementById('user-info-panel').style.display = 'block';

    try {
        // Fetch user id if not provided
        if (!userid) {
            try {
                userid = await getuserid();
                console.log('Fetched User id:', userid);
            } catch (error) {
                console.error('Error fetching user id:', error);
                userid = 'Unknown User';
            }
        } else {
            console.log('Provided User id:', userid);
        }

        // Fetch user role
        console.log(`Fetching role for userid: ${userid}`);
        const roleResponse = await fetch('/userRole');
        const roleData = await roleResponse.json();

        if (!roleData.role) {
            console.error('Error fetching user role');
            document.getElementById('user-info').innerHTML = '<p>Error fetching user role.</p>';
            return;
        }

        console.log('User Role:', roleData.role);
        const isModerator = roleData.role === 'm';

        // Fetch user info
        console.log(`Fetching user info for userid: ${userid}`);
        const response = await fetch(`/user-info/${userid}`);
        const userInfo = await response.json();

        if (!userInfo.success) {
            console.error('Error fetching user info:', userInfo.message);
            document.getElementById('user-info').innerHTML = `<p>${userInfo.message}</p>`;
            return;
        }

        console.log('User Info:', userInfo);
        let userInfoHTML = '';

        // If the user is a moderator, indicate their role first
        if (isModerator) {
            userInfoHTML += `<p><strong style="color: red">Moderator</strong></p>`;
        }
        
        // Construct user info HTML
        userInfoHTML += `
            <p><strong>Full Name:</strong> ${userInfo.userfullname}</p>
            <p><strong>School:</strong> ${userInfo.schoolfullname || 'N/A'}</p>
        `;
        
        // If the user is not a moderator, show graduation year
        if (!isModerator) {
            userInfoHTML += `<p><strong>Graduation Year:</strong> ${userInfo.usergraduationyear || 'N/A'}</p>`;
        }

        document.getElementById('user-info').innerHTML = userInfoHTML;

        // Show change password button only if viewing your own profile
        if (userid === userInfo.userid) {
            document.getElementById('change-password-btn').style.display = 'block';
            document.getElementById('change-password-btn').onclick = openPasswordModal;
        }

        // Load user posts
        console.log(`Loading posts for userid: ${userInfo.userid}`);
        const posts = await loadPost(null, userInfo.userid, false);

        console.log('Posts loaded:', posts);
        if (!Array.isArray(posts)) {
            console.error('Posts data is not an array:', posts);
            document.getElementById('my-info-container').innerHTML = '<p>Error loading posts.</p>';
            return;
        }

        if (posts.length === 0) {
            console.log('No posts found for userid:', userInfo.userid);
            document.getElementById('my-info-container').innerHTML = '<p>No posts available.</p>';
        }

        // Fetch user statistics
        console.log('Fetching user statistics for userid:', userid);
        await fetchUserStatistics(userid, false);

    } catch (error) {
        console.error('Error in showUserInfo function:', error);
        document.getElementById('user-info').innerHTML = `<p>Error fetching user info.</p>`;
    }
}



// Function to open the password modal
function openPasswordModal() {
    document.getElementById('password-modal-overlay').style.display = 'flex';

    // Close modal when clicking outside
    document.getElementById('password-modal-overlay').onclick = (event) => {
        if (event.target.classList.contains('modal-overlay')) {
            closePasswordModal();
        }
    };

    // Close modal when clicking the button
    document.getElementById('close-password-modal').onclick = closePasswordModal;
}

// Function to close the modal
function closePasswordModal() {
    document.getElementById('password-modal-overlay').style.display = 'none';
}


// Function to handle password change submission
// Function to handle password change submission
async function submitPasswordChange(event) {
    event.preventDefault(); // Prevent form reload

    const oldPassword = document.getElementById('old-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // Validate new password using your function
    const validation = validateInput(null, null, newPassword);

    if (!validation.isValid) {
        document.getElementById('password-error').innerText = validation.errors.join('\n');
        return;
    }

    if (newPassword !== confirmPassword) {
        document.getElementById('password-error').innerText = 'Passwords do not match.';
        return;
    }

    try {
        const response = await fetch('/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userid: await getuserid(), oldPassword, newPassword })
        });

        const result = await response.json();

        if (result.success) {
            displayPopupMessage(result.message, 'success'); 
            closePasswordModal();
        } else {
            displayPopupMessage(result.message, 'error'); 
        }
    } catch (error) {
        displayPopupMessage('An error occurred. Please try again.', 'error');
    }
}

// Attach event listener to form submission
document.getElementById('password-form').addEventListener('submit', submitPasswordChange);







// Modified showOtherUserInfo function to use showLatestFriends
async function showOtherUserInfo(userid = null) {
    hideAllPanels();
    document.getElementById('other-user-info-panel').style.display = 'block';

    currentUser = await getuserid();

    if (currentUser !== userid) {
        let friendContainer = document.getElementById('friend');
        try {
            if (!userid) {
                console.error('No user id provided');
                return;
            }

            const response = await fetch(`/check-status?userAddresserid=${currentUser}&userAddresseeid=${userid}`);
            const data = await response.json();
            const friendshipStatus = data.status;
            const useraddresserid = data.useraddresserid;  
            const useraddresseeid = data.useraddresseeid;  
            console.log(`User Addressee id: ${useraddresseeid}`);

            let acceptButton = null;

            console.log("Friendship status:", friendshipStatus);

            if (friendshipStatus === 'p') {
                if (useraddresseeid === currentUser) {
                    friendContainer.innerHTML = `<p>You received a friend request from this user</p>`;

                    acceptButton = document.createElement('button');
                    acceptButton.innerText = 'Accept';
                    acceptButton.addEventListener('click', async () => {
                        console.log(`Accepting friend request from ${useraddresserid}`); 
                        respondToFriendRequest('accept', useraddresserid);
                    });

                    let declineButton = document.createElement('button');
                    declineButton.innerText = 'Decline';
                    declineButton.addEventListener('click', async () => {
                        console.log(`Declining friend request from ${useraddresserid}`); 
                        respondToFriendRequest('decline', useraddresserid);
                    });

                    friendContainer.appendChild(acceptButton);
                    friendContainer.appendChild(declineButton);
                } else {
                    friendContainer.innerHTML = `<p>Friend request pending</p>`;
                }
            } else if (friendshipStatus === 'a') {
                friendContainer.innerHTML = `<p>You are friends</p>`;
            } else if (friendshipStatus === 'd') {
                friendContainer.innerHTML = `<button onclick="sendFriendRequest(null, '${userid}')">Add Friend</button>`;
            } else {
                friendContainer.innerHTML = `<p>Error determining friendship status</p>`;
            }
        } catch (error) {
            console.error('Error in checking friendship status:', error);
            friendContainer.innerHTML = `<p>Error checking friendship status</p>`;
        }
    }

    try {
        if (!userid) {
            console.error('No user id provided');
            return;
        }

        console.log(`Fetching user info for userid: ${userid}`);
        const response = await fetch(`/user-info/${userid}`);
        const userInfo = await response.json();

        if (!userInfo.success) {
            console.error('Error fetching user info:', userInfo.message);
            document.getElementById('other-user-info').innerHTML = `<p>${userInfo.message}</p>`;
            return;
        }

        console.log('User Info:', userInfo);

        document.getElementById('other-user-info').innerHTML = `
            <p><strong>Full Name:</strong> ${userInfo.userfullname}</p>
            <p><strong>School:</strong> ${userInfo.schoolfullname}</p>
            <p><strong>Graduation Year:</strong> ${userInfo.usergraduationyear}</p>
        `;

        await showLatestFriends(userid, currentUser);

        console.log(`Loading posts for userid: ${userInfo.userid}`);
        const posts = await loadPost(null, userInfo.userid, true);

        if (!Array.isArray(posts)) {
            console.error('Posts data is not an array:', posts);
            document.getElementById('other-my-info-container').innerHTML = '<p>Error loading posts.</p>';
            return;
        }

        if (posts.length === 0) {
            console.log('No posts found for userid:', userInfo.userid);
            document.getElementById('other-my-info-container').innerHTML = '<p>No posts available.</p>';
        }

        console.log('Fetching user statistics for userid:', userid);
        await fetchUserStatistics(userid, true);

        document.getElementById('other-search-button-my-info').addEventListener('click', async () => {
            try {
                search(userid, true); 
            } catch (error) {
                console.error('Error during search:', error);
            }
        });

        document.getElementById('other-search-clear-all-my-info').addEventListener('click', () => {
            clearSearchFields(false, true);
            loadPost(null, userid, true);
        });

    } catch (error) {
        console.error('Error in showOtherUserInfo function:', error);
        document.getElementById('other-user-info').innerHTML = `<p>Error fetching user info.</p>`;
    }
}



async function respondToFriendRequest(action, useraddresserid) {
    try {
        const useraddresseeid = await getuserid(); // Get current user's id
        console.log(`Responding to friend request: ${action} from ${useraddresserid} to ${useraddresseeid}`); // Added log

        const response = await fetch('/api/friends/respond', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ useraddresserid, useraddresseeid, action }),
        });

        const result = await response.json();

        if (response.ok) {
            showCustomAlert(`Friend request ${action}ed successfully.`);
            showOtherUserInfo(useraddresserid); // Refresh the user info panel
        } else {
            showCustomAlert(`Failed to ${action} the friend request: ${result.error}`);
        }
    } catch (error) {
        console.error(`Error trying to ${action} friend request:`, error);
        showCustomAlert('An error occurred while responding to the friend request');
    }
}




// FETCHING STATISTICS
async function fetchUserStatistics(userid = null, other = false) {
    try {
        // Get User id if not provided
        if (!userid) {
            userid = await getuserid();
            if (!userid) {
                throw new Error('User id is null or undefined');
            }
            console.log(`Fetched User id: ${userid}`);
        }

        // Fetch user statistics from server
        const response = await fetch(`/user-statistics/${userid}`);
        if (!response.ok) {
            throw new Error('Failed to fetch user statistics');
        }

        // Parse response JSON
        const data = await response.json();
        console.log('Fetched data:', data);

        // Ensure postsByCategory is an array
        if (!Array.isArray(data.postsByCategory)) {
            throw new Error('postsByCategory is not an array');
        }

        // Fetch category names and combine with post data
        const postsByCategoryWithNames = await Promise.all(
            data.postsByCategory.map(async (category) => {
                try {
                    const categoryName = await fetchCategoryName(category.postcascategoryid);
                    return { ...category, postCASCategory: categoryName };
                } catch (error) {
                    console.error('Error fetching category name for category:', category, error);
                    return { ...category, postCASCategory: 'Error fetching category' };
                }
            })
        );

        console.log('Posts with category names:', postsByCategoryWithNames);

        console.log('Final statistics object:', {
            ...data,
            postsByCategory: postsByCategoryWithNames
        });
        
        // Display user statistics
        displayUserStatistics({
            ...data,
            postsByCategory: postsByCategoryWithNames
        }, other);

    } catch (error) {
        console.error('Error fetching user statistics:', error);
        // Update the UI to indicate error in fetching statistics
        if (other === false) {
            document.getElementById('total-posts').textContent = 'Error loading total posts';
            document.getElementById('posts-by-category').innerHTML = '<li>Error loading categories</li>';
        } else {
            document.getElementById('other-total-posts').textContent = 'Error loading total posts';
            document.getElementById('other-posts-by-category').innerHTML = '<li>Error loading categories</li>';
        }
    }
}

// FRIENDS
async function sendFriendRequest(useraddresserid = null, useraddresseeid = null) {
    try {
        useraddresserid = await getuserid();

        const friendRequestResponse = await fetch('/api/friends/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ useraddresserid, useraddresseeid }),
        });

        console.log("addresser" + useraddresserid);

        if (friendRequestResponse.ok) {
            // Send notification
            const notificationResponse = await fetch('/api/sendNotifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userid: useraddresseeid,
                    notificationtype: 'Friend',
                    actorid: useraddresserid,
                }),
            });

            if (notificationResponse.ok) {
                showCustomAlert('Friend request sent and notification created successfully');
                showOtherUserInfo(useraddresseeid);
            } else {
                showCustomAlert('Friend request sent but failed to create notification');
            }
        } else {
            showCustomAlert('Failed to send friend request');
        }
    } catch (error) {
        console.error('Error sending friend request:', error);
        showCustomAlert('An error occurred while sending the friend request');
    }
}





// DISPLAYING STATISTICS
function displayUserStatistics(data, other = false) {
    // Select appropriate container based on whether it's 'other' or not
    const totalPostsElement = other ? document.getElementById('other-total-posts') : document.getElementById('total-posts');
    const categoryList = other ? document.getElementById('other-posts-by-category') : document.getElementById('posts-by-category');

    // Display total posts
    totalPostsElement.textContent = `Total Posts: ${data.totalPosts}`;

    // Clear previous content
    categoryList.innerHTML = '';

    // Display posts by CAS category
    if (data.postsByCategory.length === 0) {
        categoryList.innerHTML = '<li>No posts found for any category</li>';
    } else {
        data.postsByCategory.forEach(category => {
            const listItem = document.createElement('li');
            listItem.textContent = `${category.postCASCategory}: ${category.count} posts`;
            categoryList.appendChild(listItem);
        });
    }
}


// Function to fetch notifications
// Function to fetch notifications
async function fetchNotifications() {
    try {
        const userid = await getuserid();
        const response = await fetch(`/api/getNotifications?userid=${userid}`);

        if (response.ok) {
            const notifications = await response.json();

            const notificationsContainer = document.getElementById('notifications-container');
            notificationsContainer.innerHTML = '';

            const notificationPostsContainer = document.getElementById('notification-post');
            if (notificationPostsContainer) {
                notificationPostsContainer.innerHTML = '';
            } else {
                console.error('Notification posts container element not found');
                return;
            }

            if (Array.isArray(notifications) && notifications.length === 0) {
                notificationsContainer.innerHTML = '<p>No notifications</p>';
            } else if (Array.isArray(notifications)) {
                notifications.forEach(notification => {
                    const notificationElement = document.createElement('div');
                    notificationElement.classList.add('notification');

                    let message = '';
                    let seeMoreButton = null;

                    // Format notification message based on its type
                    if (notification.notificationtype === 'Like') {
                        message = `Your post was liked by ${notification.userfullname}`;
                        if (notification.postid) {
                            seeMoreButton = document.createElement('button');
                            seeMoreButton.innerText = 'See Post';
                            seeMoreButton.addEventListener('click', async () => {
                                notificationsContainer.innerHTML = '';
                                const posts = await searchPost('', '', '', '', null, false, notification.postid);
                                notificationPostsContainer.innerHTML = ''; // Clear previous posts
                                if (Array.isArray(posts) && posts.length > 0) {
                                    console.log('Posts to load:', posts);
                                    await loadPost(posts, null, false, true);
                                    console.log('Posts loaded successfully.');
                                } else {
                                    notificationPostsContainer.innerHTML = '<p>No posts available.</p>';
                                    console.log('No posts available:', posts);
                                }
                            });
                        } else {
                            console.error('Postid is undefined for Like notification');
                        }
                    } else if (notification.notificationtype === 'Comment') {
                        message = `Your post received a comment from ${notification.userfullname}`;
                        if (notification.postid) {
                            seeMoreButton = document.createElement('button');
                            seeMoreButton.innerText = 'See Post';
                            seeMoreButton.addEventListener('click', async () => {
                                notificationsContainer.innerHTML = '';
                                const posts = await searchPost('', '', '', '', null, false, notification.postid);
                                notificationPostsContainer.innerHTML = ''; // Clear previous posts
                                if (Array.isArray(posts) && posts.length > 0) {
                                    console.log('Posts to load:', posts);
                                    await loadPost(posts, null, false, true);
                                    console.log('Posts loaded successfully.');
                                } else {
                                    notificationPostsContainer.innerHTML = '<p>No posts available.</p>';
                                    console.log('No posts available:', posts);
                                }
                            });
                        } else {
                            console.error('Postid is undefined for Comment notification');
                        }
                    } else if (notification.notificationtype === 'Friend') {
                        message = `You received a friend request from ${notification.userfullname}`;
                        seeMoreButton = document.createElement('button');
                        seeMoreButton.innerText = 'See Profile';
                        seeMoreButton.addEventListener('click', () => {
                            showOtherUserInfo(notification.actorid);
                        });
                    } else {
                        message = `${notification.notificationtype}`;
                    }

                    // Add message in a paragraph element for easier styling
                    const notificationMessage = document.createElement('p');
                    notificationMessage.textContent = `${message} at ${convertUTCToLocal(notification.notificationtime)}`;
                    notificationElement.appendChild(notificationMessage);

                    // Append "See More" button if it exists
                    if (seeMoreButton) {
                        notificationElement.appendChild(seeMoreButton);
                    }

                    notificationsContainer.appendChild(notificationElement);

                    console.log('Original time:', notification.notificationtime);
                    console.log('Converted time:', convertUTCToLocal(notification.notificationtime));
                });
            } else {
                throw new Error('Invalid notifications data: Not an array');
            }
        } else {
            console.error('Failed to fetch notifications');
            const notificationsContainer = document.getElementById('notifications-container');
            notificationsContainer.innerHTML = '<p>Error fetching notifications</p>';
        }
    } catch (error) {
        console.error('Error fetching notifications:', error);
        const notificationsContainer = document.getElementById('notifications-container');
        notificationsContainer.innerHTML = '<p>Error fetching notifications</p>';
    }
}












// Show Different Panels
function showLogin() {
    hideAllPanels();
    document.getElementById('navbar').style.display = 'none';
    document.getElementById('login-panel').style.display = 'block';
    document.getElementById('login-form').reset();

}
function showSignUp() {
    hideAllPanels();
    document.getElementById('navbar').style.display = 'none';
    document.getElementById('signup-panel').style.display = 'block';
    document.getElementById('signup-form').reset();
}

function showRegister() {
    hideAllPanels();
    document.getElementById('navbar').style.display = 'none';
    document.getElementById('register-panel').style.display = 'block';
    document.getElementById('register-form').reset();
}

function showFeed() {
    hideAllPanels();
    document.getElementById('navbar').style.display = 'block';
    document.getElementById('feed-panel').style.display = 'block';
    loadPost();
    clearSearchFields();
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = ''; // Clear previous results
}

function showPostCreator(){
    hideAllPanels();
    document.getElementById('navbar').style.display = 'block';
    document.getElementById('post-creator-panel').style.display = 'block';
}

function showNotifications() {
    hideAllPanels();
    document.getElementById('notification-panel').style.display = 'block';

    // Fetch notifications from the server
    fetchNotifications();
}

function hideAllPanels() {
    document.getElementById('login-panel').style.display = 'none';
    document.getElementById('signup-panel').style.display = 'none';
    document.getElementById('register-panel').style.display = 'none';
    document.getElementById('feed-panel').style.display = 'none';
    document.getElementById('post-creator-panel').style.display = 'none';
    document.getElementById('user-info-panel').style.display = 'none';
    document.getElementById('other-user-info-panel').style.display = 'none';
    document.getElementById('notification-panel').style.display = 'none';
}