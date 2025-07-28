# ChillFi3 Server

Private music library server built with Node.js, Socket.IO, and MySQL.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```
# Database
DB_HOST=localhost
DB_USER=musiclib
DB_PASSWORD=your_mysql_password
DB_NAME=musiclib

# AWS S3 (optional)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-west-2
S3_BUCKET_NAME=chillfi

# Server
PORT=3005
JWT_SECRET=your_jwt_secret
NODE_ENV=production
```

3. Start the server:
```bash
npm start
# or for development with auto-restart:
npm run dev
```

4. Create admin user:
Open the application in your browser and create the first user account. The first user automatically becomes an admin.

## Features

- **Authentication**: JWT-based authentication with session management
- **User Management**: User profiles, avatars, and statistics
- **Music Library**: Song upload, metadata management, and streaming
- **Playlists**: Create and manage music playlists
- **Real-time**: Socket.IO for real-time communication
- **File Storage**: AWS S3 integration for audio files and images
- **Database**: MySQL with automatic schema management

## API Documentation

See [API.md](./API.md) for complete Socket.IO event documentation.

## Architecture

- `server.js` - Main server entry point
- `database.js` - Database connection and schema management
- `auth.js` - Authentication and authorization
- `users.js` - User profile management
- `songs.js` - Music library and upload handling
- `playlists.js` - Playlist management
- `player.js` - Queue management

## Security

- Passwords hashed with bcrypt
- JWT tokens with 7-day expiration
- HTTPS required in production
- CORS protection
- Helmet security headers
- Input validation and sanitization

## Deployment

The server is designed to run on AWS EC2 with:
- HTTPS certificates from Let's Encrypt
- MySQL RDS database
- S3 bucket for file storage
- Nginx reverse proxy for static files