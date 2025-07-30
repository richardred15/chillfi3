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

### Docker Installation (Recommended)
```bash
# Clone and run automated installer
git clone https://github.com/richardred15/chillfi3.git
cd chillfi3
chmod +x install-docker.sh
./install-docker.sh
```

The installer guides you through:
- AWS S3 bucket configuration
- Database and Redis setup
- Admin user creation
- Service deployment

### Manual Installation

**Prerequisites:**
- Node.js 18+, PHP 8.0+, MySQL/MariaDB, Redis
- **AWS S3 Bucket** (required for file storage)

1. **Clone and install**
```bash
git clone https://github.com/richardred15/chillfi3.git
cd chillfi3
cd server && npm install
```

2. **Configure environment**
```bash
cp server/.env.example server/.env
cp .env.client.example .env.client
# Edit files with your AWS S3 credentials and database settings
```

3. **Start services**
```bash
cd server && npm start
# Database schema created automatically
```

4. **Create admin user**
```bash
# In server console
create-admin admin your_password
```

5. **Access application**
Open http://localhost and login with admin credentials.

## 🐳 Docker Deployment

### Automated Installation (Recommended)
```bash
# Clone repository
git clone https://github.com/richardred15/chillfi3.git
cd chillfi3

# Run interactive installer
chmod +x install-docker.sh
./install-docker.sh
```

The installer will:
- Install Docker and Docker Compose
- Guide you through configuration (AWS S3, database, admin user)
- Build and start all services (app, database, Redis)
- Create your admin user automatically

### Manual Docker Setup
```bash
# Install Docker
sudo apt update && sudo apt install -y docker.io docker-compose
sudo usermod -aG docker $USER && newgrp docker

# Configure environment files
cp server/.env.example server/.env
cp .env.client.example .env.client
# Edit the .env files with your AWS S3 credentials

# Start services
docker-compose up -d

# Create admin user
echo "create-admin admin your_password" | docker-compose exec -T app sh -c "cd /app/server && node server.js"
```

### Production Deployment
```bash
# Setup production secrets
mkdir -p secrets
echo "your_root_password" > secrets/db_root_password.txt
echo "your_db_password" > secrets/db_password.txt

# Deploy with production config
docker-compose -f docker-compose.prod.yml up -d
```

### Docker Services
The Docker setup includes:
- **App**: ChillFi3 server (Node.js + PHP + Nginx)
- **Database**: MariaDB for metadata storage
- **Redis**: Caching and session management

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

## 🗄️ AWS S3 Bucket Setup

ChillFi3 requires an AWS S3 bucket for storing audio files and artwork. The application automatically creates the necessary folder structure.

### Required S3 Bucket Folders

The following folders will be created automatically when files are uploaded:

```
your-bucket-name/
├── songs/              # Audio files (MP3, FLAC, etc.)
├── song_art/           # Individual song artwork
├── album_art/          # Album artwork
├── artist_images/      # Artist profile images
└── profiles/           # User profile pictures
```

### S3 Bucket Configuration

1. **Create an S3 bucket** in your preferred AWS region
2. **Set bucket permissions** to allow your application access:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "AWS": "arn:aws:iam::YOUR-ACCOUNT:user/YOUR-USER"
         },
         "Action": [
           "s3:GetObject",
           "s3:PutObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::your-bucket-name",
           "arn:aws:s3:::your-bucket-name/*"
         ]
       }
     ]
   }
   ```
3. **Configure CORS** for web access:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedOrigins": ["https://your-domain.com"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```
4. **Create IAM user** with programmatic access and attach the above policy
5. **Note the Access Key ID and Secret Access Key** for your `.env` file

### S3 Security Features

- **Signed URLs**: All file access uses temporary signed URLs for security
- **Hash-based naming**: Files are stored with SHA-256 hashes to prevent conflicts
- **Automatic cleanup**: Deleted songs/albums remove associated S3 files

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

# AWS S3 (required)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET_NAME=your_bucket
AWS_REGION=us-west-2

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

### S3 Storage Costs

**Estimated monthly costs for S3 storage:**
- **1,000 songs** (~4GB): $0.10/month
- **10,000 songs** (~40GB): $1.00/month  
- **100,000 songs** (~400GB): $10.00/month

*Costs include storage, requests, and data transfer. Actual costs may vary by region and usage patterns.*

## 🛠️ Development

```bash
# Start development server
cd server
npm run dev

# Run tests
cd server
npm test

# Docker development
docker-compose up -d
docker-compose logs -f

# Docker management
docker-compose down          # Stop services
docker-compose build         # Rebuild after changes
docker-compose restart app   # Restart app service
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