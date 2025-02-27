const { Pool } = require('pg');
const fs = require('fs').promises; // Use promises API for async/await
const path = require('path');
require('dotenv').config(); // Load environment variables

// Ensure DATABASE_URL is provided
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1); // Exit with failure
}

// PostgreSQL connection config
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Path to SQL schema file
const schemaPath = path.join(__dirname, 'schema.sql');

async function setupDatabase() {
    try {
        // Read the SQL schema file
        const schema = await fs.readFile(schemaPath, 'utf8');

        // Connect to PostgreSQL
        const client = await pool.connect();

        try {
            // Execute schema
            await client.query(schema);
            console.log('Database schema initialized successfully.');

            // Insert initial data
            await client.query(`
                INSERT INTO friendshipStatus (statusID, statusName) VALUES
                ('p', 'Pending'),
                ('a', 'Accepted'),
                ('d', 'Declined')
                ON CONFLICT (statusID) DO NOTHING;
            `);
            console.log('Initial data inserted successfully.');
        } finally {
            client.release(); // Always release the client
        }
    } catch (error) {
        console.error('Error setting up database:', error);
    } finally {
        await pool.end(); // Ensure connection is closed
    }
}

// Run the setup function
setupDatabase();
