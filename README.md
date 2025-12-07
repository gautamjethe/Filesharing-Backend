# Backend - File Sharing API

Node.js/Express backend for the file sharing application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=file_sharing_db
JWT_SECRET=your_secret_key
UPLOAD_DIR=./uploads
```

3. Create database:
```bash
mysql -u root -p < database.sql
```

4. Start server:
```bash
npm start
```

## Project Structure

- `config/db.js` - Database connection pool
- `middleware/auth.js` - JWT authentication middleware
- `middleware/fileAccess.js` - File access control middleware
- `routes/auth.js` - Authentication routes
- `routes/files.js` - File management routes
- `routes/users.js` - User routes
- `server.js` - Express app entry point
- `database.sql` - Database schema

## API Documentation

See main README.md for API endpoints.

