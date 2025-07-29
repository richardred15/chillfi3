# ChillFi3 🎵

[![CI/CD Pipeline](https://github.com/richardred15/chillfi3/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/richardred15/chillfi3/actions/workflows/ci.yml)

A modern, self-hosted private music library with real-time streaming, social sharing, and beautiful UI.

## ✨ Features

- **Private Music Library** - Upload and organize your music collection
- **Real-time Streaming** - Instant playback with queue management
- **Social Sharing** - Share songs, albums, and playlists with OpenGraph support
- **User Management** - Multi-user support with admin controls
- **Responsive Design** - Works on desktop and mobile
- **Themes** - Multiple UI themes available
- **Search & Discovery** - Fast search across your library
- **Playlist Management** - Create and share playlists

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PHP 8.0+
- MySQL/MariaDB
- Redis (for caching and session management)
- Web server (nginx/Apache)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/richardred15/chillfi3.git
cd chillfi3
```

2. **Install dependencies**
```bash
cd server
npm install
```

3. **Configure environment**
```bash
# Server configuration
cp server/.env.example server/.env
# Edit server/.env with your database and AWS credentials

# Client configuration  
cp .env.client.example .env.client
# Edit .env.client with your API URL and app name
```

4. **Start the server**
```bash
cd server
npm start
# Database will be created automatically on first run
```

5. **Create admin user**
In the server console, create your first admin user:
```bash
# In the server console (where npm start is running)
create-admin admin your_password
```

6. **Access the application**
Open http://localhost:3005 in your browser and login with your admin credentials.

## 🐳 Docker Deployment

### Quick Start with Docker
```bash
# Configure environment files
cp server/.env.example server/.env
cp .env.client.example .env.client
# Edit the .env files with your settings

# Build and run
docker build -t chillfi3 .
docker-compose up -d
```

### Production Deployment
```bash
# Setup production secrets
cp secrets/db_root_password.txt.example secrets/db_root_password.txt
cp secrets/db_password.txt.example secrets/db_password.txt
# Edit secrets with secure passwords

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

### Manual Docker
```bash
# Setup environment
cp server/.env.example server/.env
cp .env.client.example .env.client

# Build and run
docker build -t chillfi3 .
docker-compose up -d
```

### Database Setup
The database schema is automatically created when the server starts. Simply ensure your database credentials are correct in the `.env` files.

## 🔒 HTTPS Setup

### Let's Encrypt with Certbot

1. **Install Certbot**
```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx
```

2. **Obtain SSL Certificate**
```bash
# Replace with your domain
sudo certbot --nginx -d your-domain.com
```

3. **Configure ChillFi3 for HTTPS**
```bash
# Update server/.env
HTTPS_KEY=/etc/letsencrypt/live/your-domain.com/privkey.pem
HTTPS_CERT=/etc/letsencrypt/live/your-domain.com/fullchain.pem
HTTPS_CA=/etc/letsencrypt/live/your-domain.com/chain.pem

# Update .env.client
API_URL=https://your-domain.com/api
```

4. **Auto-renewal**
```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab for auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Docker with HTTPS

1. **Create SSL directory**
```bash
mkdir -p ssl
```

2. **Copy certificates**
```bash
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/chain.pem ssl/
sudo chown $USER:$USER ssl/*
```

3. **Update environment**
```bash
# server/.env
HTTPS_KEY=/app/ssl/privkey.pem
HTTPS_CERT=/app/ssl/fullchain.pem
HTTPS_CA=/app/ssl/chain.pem
```

4. **Deploy with HTTPS**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Manual HTTPS Setup

For custom certificates or other CA providers:

```bash
# server/.env
HTTPS_KEY=/path/to/private.key
HTTPS_CERT=/path/to/certificate.crt
HTTPS_CA=/path/to/ca-bundle.crt
```

## 📁 Project Structure

```
chillfi3/
├── client/           # Frontend assets
│   ├── css/         # Stylesheets
│   ├── js/          # JavaScript modules
│   └── icons/       # SVG icons
├── server/          # Node.js backend
│   ├── routes/      # API routes
│   ├── services/    # Business logic
│   └── middleware/  # Express middleware
├── docker/          # Docker configurations
└── scripts/         # Deployment scripts
```

## 🔧 Configuration

### Environment Variables

**Server (.env)**
```env
# Database
DB_HOST=localhost
DB_USER=musiclib
DB_PASSWORD=your_password
DB_NAME=musiclib

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# AWS S3 (optional)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET_NAME=your_bucket

# Server
PORT=3005
JWT_SECRET=your_jwt_secret

# Logging
LOG_LEVEL=info
LOG_FILE=logs/chillfi3.log
```

**Client (.env.client)**
```env
APP_NAME=ChillFi3
API_URL=https://your-domain.com/api
```

## 🛠️ Development

```bash
# Start development server
cd server
npm run dev

# Run tests
cd server
npm test

# Build for production
docker build -t chillfi3 .
```

## 📖 API Documentation

See [server/API.md](server/API.md) for complete API documentation.

## 🎨 Themes

ChillFi3 supports multiple themes:
- Default (Dark)
- Ocean
- Spotify
- Sunset
- Synthwave

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- Check the [Issues](https://github.com/richardred15/chillfi3/issues) page
- Read the [Documentation](docs/)

## 🙏 Acknowledgments

Built with modern web technologies:
- Node.js & Express
- Socket.IO for real-time features
- Vanilla JavaScript (ES6 modules)
- PHP for server-side rendering
- MySQL for data storage
- Redis for caching and session management
- Winston for structured logging