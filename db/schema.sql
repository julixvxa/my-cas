-- Table for schools
CREATE TABLE school (
    schoolID SERIAL PRIMARY KEY,
    schoolFullName TEXT NOT NULL
);

-- Table for user profiles
CREATE TABLE userProfile (
    userID TEXT PRIMARY KEY,
    userFullName TEXT NOT NULL,
    userPasswordHash TEXT NOT NULL,
    schoolID INTEGER,
    userRole TEXT NOT NULL,
    userGraduationYear INTEGER,
    FOREIGN KEY (schoolID) REFERENCES school(schoolID) ON DELETE SET NULL
);

-- Table for posts
CREATE TABLE post (
    postID SERIAL PRIMARY KEY,
    userID TEXT,
    postCASCategoryID INTEGER,
    postMonthID INTEGER,
    postText TEXT NOT NULL,
    postPrivacyID INTEGER,
    postDate TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (userID) REFERENCES userProfile(userID) ON DELETE CASCADE
);

-- Table for comments on posts
CREATE TABLE comments (
    commentID SERIAL PRIMARY KEY,
    postID INTEGER,
    commentDate TIMESTAMP DEFAULT NOW(),
    commentText TEXT NOT NULL,
    commentingUserID TEXT NOT NULL,
    FOREIGN KEY (postID) REFERENCES post(postID) ON DELETE CASCADE,
    FOREIGN KEY (commentingUserID) REFERENCES userProfile(userID) ON DELETE CASCADE
);

-- Table for likes on posts
CREATE TABLE likes (
    postID INTEGER NOT NULL,
    userID TEXT NOT NULL,
    FOREIGN KEY (postID) REFERENCES post(postID) ON DELETE CASCADE,
    FOREIGN KEY (userID) REFERENCES userProfile(userID) ON DELETE CASCADE,
    UNIQUE (postID, userID) -- Ensures a user can only like a post once
);

-- Table for friendship statuses
CREATE TABLE friendshipStatus (
    statusID TEXT PRIMARY KEY,
    statusName TEXT NOT NULL
);

-- Table for media associated with posts
CREATE TABLE media (
    postID INTEGER,
    mediaFile TEXT PRIMARY KEY,
    FOREIGN KEY (postID) REFERENCES post(postID) ON DELETE CASCADE
);

-- Table for notifications
CREATE TABLE notifications (
    notificationID SERIAL PRIMARY KEY,
    userID TEXT,
    notificationType TEXT NOT NULL,
    notificationTime TIMESTAMP DEFAULT NOW(),
    actorID TEXT,
    postID INTEGER,
    FOREIGN KEY (postID) REFERENCES post(postID) ON DELETE CASCADE,
    FOREIGN KEY (actorID) REFERENCES userProfile(userID) ON DELETE SET NULL,
    FOREIGN KEY (userID) REFERENCES userProfile(userID) ON DELETE CASCADE
);

-- Table for friends
CREATE TABLE friends (
    friendshipID SERIAL PRIMARY KEY,
    userAddresserID TEXT,
    userAddresseeID TEXT,
    statusID TEXT DEFAULT 'd',
    FOREIGN KEY (userAddresserID) REFERENCES userProfile(userID) ON DELETE CASCADE,
    FOREIGN KEY (userAddresseeID) REFERENCES userProfile(userID) ON DELETE CASCADE,
    FOREIGN KEY (statusID) REFERENCES friendshipStatus(statusID),
    UNIQUE (userAddresserID, userAddresseeID) -- Ensures no duplicate relationships
);
