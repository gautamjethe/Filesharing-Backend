const pool = require('./config/db');
require('dotenv').config();

async function testConnection() {
    try {
        console.log('Testing database connection...');
        console.log('Database config:', {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            database: process.env.DB_NAME
        });

        const [rows] = await pool.execute('SELECT 1 as test');
        console.log('✅ Database connection successful!');
        console.log('Test query result:', rows);

        // Test if database exists and get version
        const [version] = await pool.execute('SELECT VERSION() as version');
        console.log('MySQL version:', version[0].version);

        // Check if tables exist
        const [tables] = await pool.execute(
            `SELECT TABLE_NAME 
             FROM information_schema.TABLES 
             WHERE TABLE_SCHEMA = ?`,
            [process.env.DB_NAME]
        );

        if (tables.length > 0) {
            console.log('\n📊 Existing tables:');
            tables.forEach(table => {
                console.log(`  - ${table.TABLE_NAME}`);
            });
        } else {
            console.log('\n⚠️  No tables found. Please run database.sql to create tables.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Database connection failed!');
        console.error('Error:', error.message);
        console.error('\nPlease check:');
        console.error('1. MySQL server is running');
        console.error('2. Database credentials in .env file are correct');
        console.error('3. Database "file_sharing_db" exists (run database.sql)');
        process.exit(1);
    }
}

testConnection();

