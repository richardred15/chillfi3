# Production Deployment Guide

Best practices for deploying ChillFi3 in production environments.

## Pre-Deployment Checklist

### Security Requirements
- [ ] Strong passwords for all accounts
- [ ] SSL/TLS certificates configured
- [ ] Firewall rules configured
- [ ] Regular backup strategy
- [ ] Security updates scheduled

### Infrastructure Requirements
- [ ] Adequate server resources
- [ ] Domain name configured
- [ ] DNS records set up
- [ ] Load balancer (if needed)
- [ ] Monitoring configured

## Production Deployment

### Method 1: Docker Production

```bash
# 1. Setup production secrets
mkdir -p secrets
echo "$(openssl rand -base64 32)" > secrets/db_root_password.txt
echo "$(openssl rand -base64 32)" > secrets/db_password.txt
chmod 600 secrets/*.txt

# 2. Configure environment
cp server/.env.example server/.env
cp .env.client.example .env.client

# Edit with production values
nano server/.env
nano .env.client

# 3. Deploy
npm run deploy
```

### Method 2: Manual Production

```bash
# 1. Create production user
sudo useradd -m -s /bin/bash chillfi3
sudo usermod -aG www-data chillfi3

# 2. Deploy application
sudo -u chillfi3 git clone https://github.com/richardred15/chillfi3.git /home/chillfi3/app
cd /home/chillfi3/app
sudo -u chillfi3 npm run install-deps

# 3. Configure services
sudo cp docs/examples/systemd/chillfi3.service /etc/systemd/system/
sudo systemctl enable chillfi3
sudo systemctl start chillfi3

# 4. Configure reverse proxy
sudo cp docs/examples/nginx-production.conf /etc/nginx/sites-available/chillfi3
sudo ln -s /etc/nginx/sites-available/chillfi3 /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

## Production Configuration

### Environment Variables

```env
# Production server/.env
NODE_ENV=production
PORT=3005
HOST=127.0.0.1

# Database
DB_HOST=localhost
DB_USER=musiclib
DB_PASSWORD=your_secure_production_password
DB_NAME=musiclib

# Security
JWT_SECRET=your_64_character_production_jwt_secret_here
TOKEN_EXPIRY=24h

# HTTPS
HTTPS_KEY=/etc/ssl/private/chillfi3.key
HTTPS_CERT=/etc/ssl/certs/chillfi3.crt
HTTPS_CA=/etc/ssl/certs/ca-bundle.crt

# AWS S3 (Recommended for production)
AWS_ACCESS_KEY_ID=your_production_access_key
AWS_SECRET_ACCESS_KEY=your_production_secret_key
S3_BUCKET_NAME=chillfi3-production

# Logging
LOG_LEVEL=WARN
```

### Nginx Production Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/certs/chillfi3.crt;
    ssl_certificate_key /etc/ssl/private/chillfi3.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer-when-downgrade always;
    
    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=2r/s;
    
    root /home/chillfi3/app;
    index index.php;
    
    # Static files with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Upload endpoints with higher limits
    location /api/upload {
        limit_req zone=upload burst=5 nodelay;
        client_max_body_size 100M;
        proxy_pass http://127.0.0.1:3005;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
    
    # PHP files
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;
    }
    
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
}
```

## Performance Optimization

### Database Optimization

```sql
-- MySQL production settings
SET GLOBAL innodb_buffer_pool_size = 1073741824; -- 1GB
SET GLOBAL query_cache_size = 268435456; -- 256MB
SET GLOBAL max_connections = 200;

-- Indexes for performance
CREATE INDEX idx_songs_uploaded_by ON songs(uploaded_by);
CREATE INDEX idx_songs_artist_id ON songs(artist_id);
CREATE INDEX idx_songs_album_id ON songs(album_id);
CREATE INDEX idx_song_listens_song_id ON song_listens(song_id);
CREATE INDEX idx_song_listens_user_id ON song_listens(user_id);
```

### Node.js Optimization

```bash
# Use PM2 for process management
npm install -g pm2

# PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'chillfi3',
    script: 'server.js',
    cwd: '/home/chillfi3/app/server',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3005
    },
    error_file: '/var/log/chillfi3/error.log',
    out_file: '/var/log/chillfi3/out.log',
    log_file: '/var/log/chillfi3/combined.log'
  }]
}
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Monitoring & Logging

### Log Management

```bash
# Setup log rotation
sudo tee /etc/logrotate.d/chillfi3 << EOF
/var/log/chillfi3/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 chillfi3 chillfi3
    postrotate
        pm2 reload chillfi3
    endscript
}
EOF
```

### Health Monitoring

```bash
# Basic health check script
cat > /home/chillfi3/health-check.sh << 'EOF'
#!/bin/bash
HEALTH_URL="https://your-domain.com/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "$(date): ChillFi3 is healthy"
else
    echo "$(date): ChillFi3 health check failed (HTTP $RESPONSE)"
    # Restart service if needed
    pm2 restart chillfi3
fi
EOF

chmod +x /home/chillfi3/health-check.sh

# Add to crontab
echo "*/5 * * * * /home/chillfi3/health-check.sh >> /var/log/chillfi3/health.log" | crontab -
```

## Backup Strategy

### Database Backup

```bash
# Automated backup script
cat > /home/chillfi3/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/chillfi3/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="musiclib"

mkdir -p $BACKUP_DIR

# Database backup
mysqldump --single-transaction --routines --triggers $DB_NAME > $BACKUP_DIR/db_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/db_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete

echo "$(date): Database backup completed: db_$DATE.sql.gz"
EOF

chmod +x /home/chillfi3/backup.sh

# Schedule daily backups
echo "0 2 * * * /home/chillfi3/backup.sh >> /var/log/chillfi3/backup.log" | crontab -
```

### File Backup (if not using S3)

```bash
# File backup script
cat > /home/chillfi3/file-backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/chillfi3/backups"
DATE=$(date +%Y%m%d_%H%M%S)
UPLOAD_DIR="/home/chillfi3/app/uploads"

if [ -d "$UPLOAD_DIR" ]; then
    tar -czf $BACKUP_DIR/files_$DATE.tar.gz -C $UPLOAD_DIR .
    find $BACKUP_DIR -name "files_*.tar.gz" -mtime +7 -delete
    echo "$(date): File backup completed: files_$DATE.tar.gz"
fi
EOF

chmod +x /home/chillfi3/file-backup.sh
```

## Security Hardening

### Firewall Configuration

```bash
# UFW firewall rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Fail2Ban Configuration

```bash
# Install fail2ban
sudo apt install fail2ban

# Configure jail for nginx
sudo tee /etc/fail2ban/jail.d/nginx.conf << EOF
[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
bantime = 3600

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
bantime = 600
EOF

sudo systemctl restart fail2ban
```

## Maintenance

### Regular Updates

```bash
# Update script
cat > /home/chillfi3/update.sh << 'EOF'
#!/bin/bash
cd /home/chillfi3/app

# Backup before update
./backup.sh

# Pull latest changes
git pull origin main

# Update dependencies
npm run install-deps

# Restart services
pm2 restart chillfi3

echo "$(date): Update completed"
EOF

chmod +x /home/chillfi3/update.sh
```

### Performance Monitoring

```bash
# System monitoring
sudo apt install htop iotop nethogs

# Database monitoring
mysql -e "SHOW PROCESSLIST;"
mysql -e "SHOW ENGINE INNODB STATUS\G"

# Application monitoring
pm2 monit
pm2 logs chillfi3
```

## Troubleshooting Production Issues

### Common Production Problems

**High CPU usage:**
- Check PM2 cluster mode
- Monitor database queries
- Review nginx access logs

**Memory leaks:**
- Monitor with `pm2 monit`
- Check for unclosed database connections
- Review application logs

**Database performance:**
- Check slow query log
- Analyze query execution plans
- Consider adding indexes

**SSL certificate issues:**
- Verify certificate expiration
- Check certificate chain
- Test with SSL Labs

### Emergency Procedures

**Service restart:**
```bash
pm2 restart chillfi3
sudo systemctl restart nginx
sudo systemctl restart mysql
```

**Database recovery:**
```bash
# Restore from backup
gunzip /home/chillfi3/backups/db_YYYYMMDD_HHMMSS.sql.gz
mysql musiclib < /home/chillfi3/backups/db_YYYYMMDD_HHMMSS.sql
```

**Rollback deployment:**
```bash
cd /home/chillfi3/app
git reset --hard HEAD~1
npm run install-deps
pm2 restart chillfi3
```