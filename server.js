const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./config/db');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

async function testDatabaseConnection() {
    try {
        
        

        const [rows] = await pool.execute('SELECT 1 as test');
        console.log('Database connection successful!');

        const [version] = await pool.execute('SELECT VERSION() as version');
        console.log('MySQL version:', version[0].version);

        
        
    } catch (error) {
        console.error(' Database connection failed!');
       
    }
}

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await testDatabaseConnection();
});

