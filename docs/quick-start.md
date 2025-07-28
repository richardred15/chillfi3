# Quick Start Guide

Get ChillFi3 running in 5 minutes with Docker.

## Prerequisites

- Docker and Docker Compose
- Git

## 1. Clone Repository

```bash
git clone https://github.com/richardred15/chillfi3.git
cd chillfi3
```

## 2. Configure Environment

```bash
# Copy example files
cp server/.env.example server/.env
cp .env.client.example .env.client

# Edit server/.env with your settings
nano server/.env
```

**Minimum required settings:**
```env
DB_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret_key
```

## 3. Start Services

```bash
# Build and start
docker build -t chillfi3 .
docker-compose up -d
```

## 4. Access Application

Open http://localhost in your browser. The database will be created automatically on first run.

Create your admin account through the web interface:
1. Click "Create Account" 
2. Fill in your details
3. The first user automatically becomes an admin

## Next Steps

- [Upload music files](user-management.md#uploading-music)
- [Configure HTTPS](https.md)
- [Set up production deployment](production.md)

## Troubleshooting

**Container won't start?**
- Check Docker is running
- Verify port 80 is available

**Can't login?**
- Ensure admin user was created
- Check server logs: `docker logs chillfi3-app-1`

**Database connection failed?**
- Wait 30 seconds for MySQL to initialize
- Check `.env` database settings