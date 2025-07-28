# Configuration Guide

Complete configuration reference for ChillFi3.

## Environment Files

### Server Configuration (`server/.env`)

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=musiclib
DB_PASSWORD=your_secure_password
DB_NAME=musiclib

# Server Configuration
PORT=3005
HOST=localhost
NODE_ENV=production

# Authentication
JWT_SECRET=your_jwt_secret_key_here
TOKEN_EXPIRY=7d

# AWS S3 Storage (Optional)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-west-2
S3_BUCKET_NAME=your-bucket-name

# HTTPS Configuration (Optional)
HTTPS_KEY=/path/to/private.key
HTTPS_CERT=/path/to/certificate.crt
HTTPS_CA=/path/to/ca-bundle.crt

# Upload Limits
MAX_FILE_SIZE=104857600
CHUNK_SIZE=524288

# Logging
LOG_LEVEL=INFO
```

### Client Configuration (`.env.client`)

```env
# Application Settings
APP_NAME=ChillFi3
API_URL=https://your-domain.com/api

# Optional: Development URL
DEV_CLIENT_URL=http://localhost:3000
```

## Configuration Options

### Database Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | localhost | Database server hostname |
| `DB_PORT` | 3306 | Database server port |
| `DB_USER` | musiclib | Database username |
| `DB_PASSWORD` | - | Database password (required) |
| `DB_NAME` | musiclib | Database name |

### Server Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3005 | Server port |
| `HOST` | localhost | Server hostname |
| `NODE_ENV` | development | Environment (development/production) |

### Authentication Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | - | JWT signing secret (required) |
| `TOKEN_EXPIRY` | 7d | Token expiration time |

### AWS S3 Settings (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | - | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | - | AWS secret key |
| `AWS_REGION` | us-west-2 | AWS region |
| `S3_BUCKET_NAME` | - | S3 bucket name |

### Upload Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_FILE_SIZE` | 104857600 | Max file size (100MB) |
| `CHUNK_SIZE` | 524288 | Upload chunk size (512KB) |

## Docker Configuration

### Development (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "80:80"
      - "3005:3005"
    environment:
      - NODE_ENV=development
    volumes:
      - ./.env.client:/app/.env.client
      - ./server/.env:/app/server/.env
    depends_on:
      - db

  db:
    image: mariadb:10.11
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: musiclib
      MYSQL_USER: musiclib
      MYSQL_PASSWORD: musiclib_password
    volumes:
      - db_data:/var/lib/mysql
    ports:
      - "3306:3306"

volumes:
  db_data:
```

### Production (`docker-compose.prod.yml`)

Uses Docker secrets for enhanced security:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "80:80"
      - "443:443"
    environment:
      - NODE_ENV=production
    volumes:
      - ./.env.client:/app/.env.client:ro
      - ./server/.env:/app/server/.env:ro
      - ./ssl:/app/ssl:ro

  db:
    image: mariadb:10.11
    environment:
      MYSQL_ROOT_PASSWORD_FILE: /run/secrets/db_root_password
      MYSQL_DATABASE: musiclib
      MYSQL_USER: musiclib
      MYSQL_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_root_password
      - db_password

secrets:
  db_root_password:
    file: ./secrets/db_root_password.txt
  db_password:
    file: ./secrets/db_password.txt
```

## Web Server Configuration

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/chillfi3;
    index index.php;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";

    # Static files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy to Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # PHP files
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # Main application
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
}
```

## Security Configuration

### Production Security Checklist

- [ ] Change default passwords
- [ ] Use strong JWT secret (32+ characters)
- [ ] Enable HTTPS
- [ ] Configure firewall
- [ ] Set up fail2ban
- [ ] Regular security updates
- [ ] Database access restrictions
- [ ] File upload restrictions

### Recommended JWT Secret Generation

```bash
# Generate secure JWT secret
openssl rand -base64 32
```

### Database Security

The application automatically creates the required database and tables. For additional security:

```sql
-- Remove anonymous users (if they exist)
DELETE FROM mysql.user WHERE User='';

-- Remove remote root access
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');

-- Remove test database
DROP DATABASE IF EXISTS test;

-- Reload privileges
FLUSH PRIVILEGES;
```

## Troubleshooting Configuration

### Common Issues

**Database connection failed:**
- Verify database credentials in `.env`
- Check database server is running
- Database and tables are created automatically on first run

**File uploads failing:**
- Check `MAX_FILE_SIZE` setting
- Verify disk space available
- Check file permissions

**HTTPS not working:**
- Verify certificate paths
- Check certificate validity
- Ensure ports 443 is open

### Configuration Validation

```bash
# Test database connection
cd server
echo "status" | node server.js

# Validate configuration
npm run test

# Check logs
docker logs chillfi3-app-1
```