# Troubleshooting Guide

Common issues and solutions for ChillFi3.

## Installation Issues

### Docker Issues

**Container won't start**
```bash
# Check Docker status
sudo systemctl status docker

# Check container logs
docker logs chillfi3-app-1

# Check port conflicts
sudo netstat -tulpn | grep :80
```

**Database connection failed**
```bash
# Wait for MySQL to initialize (30-60 seconds)
docker logs chillfi3-db-1

# Check database credentials
docker exec -it chillfi3-db-1 mysql -u musiclib -p

# Restart containers
docker-compose down && docker-compose up -d
```

**Permission denied errors**
```bash
# Fix file permissions
sudo chown -R $USER:$USER .
chmod +x scripts/*.sh

# Fix Docker permissions
sudo usermod -aG docker $USER
newgrp docker
```

### Manual Installation Issues

**Node.js version incompatible**
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify version
node --version
```

**NPM install fails**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Use specific npm version
npm install -g npm@9
```

**Database connection fails**
```bash
# Check MySQL service
sudo systemctl status mysql

# Reset MySQL root password if needed
sudo mysql_secure_installation

# Database and tables are created automatically on first run
# Just ensure MySQL is running and credentials are correct
```

## Runtime Issues

### Application Won't Start

**Port already in use**
```bash
# Find process using port
sudo lsof -i :3005
sudo lsof -i :80

# Kill process
sudo kill -9 <PID>

# Change port in .env
echo "PORT=3006" >> server/.env
```

**Environment file not found**
```bash
# Check file exists
ls -la server/.env .env.client

# Copy from examples
cp server/.env.example server/.env
cp .env.client.example .env.client

# Set proper permissions
chmod 600 server/.env .env.client
```

**Database connection errors**
```bash
# Test database connection
mysql -h localhost -u musiclib -p musiclib

# Check database exists
mysql -e "SHOW DATABASES;"

# Verify user permissions
mysql -e "SHOW GRANTS FOR 'musiclib'@'localhost';"
```

### Authentication Issues

**Can't login with admin user**
```bash
# Create admin user through server console
# In the server console (where npm start is running):
create-admin admin your_password

# Or check existing users in database
mysql musiclib -e "SELECT id, username, is_admin FROM users;"
```

**JWT token errors**
```bash
# Check JWT secret is set
grep JWT_SECRET server/.env

# Generate new JWT secret
openssl rand -base64 32

# Clear all sessions
mysql musiclib -e "DELETE FROM sessions;"
```

**Session expired constantly**
```bash
# Check token expiry setting
grep TOKEN_EXPIRY server/.env

# Increase token expiry
echo "TOKEN_EXPIRY=7d" >> server/.env

# Restart application
pm2 restart chillfi3
```

### File Upload Issues

**Upload fails immediately**
```bash
# Check disk space
df -h

# Check file permissions
ls -la uploads/
sudo chown -R www-data:www-data uploads/

# Check upload limits
grep MAX_FILE_SIZE server/.env
```

**Large files fail to upload**
```bash
# Increase upload limits in .env
echo "MAX_FILE_SIZE=209715200" >> server/.env  # 200MB

# Check nginx limits
sudo nano /etc/nginx/sites-available/chillfi3
# Add: client_max_body_size 200M;

# Restart services
sudo systemctl reload nginx
pm2 restart chillfi3
```

**AWS S3 upload errors**
```bash
# Check AWS credentials
aws configure list

# Test S3 access
aws s3 ls s3://your-bucket-name

# Check bucket permissions
aws s3api get-bucket-policy --bucket your-bucket-name
```

### Performance Issues

**Slow page loading**
```bash
# Check server resources
htop
free -h
df -h

# Check database performance
mysql musiclib -e "SHOW PROCESSLIST;"

# Check nginx logs
sudo tail -f /var/log/nginx/access.log
```

**High memory usage**
```bash
# Check Node.js memory usage
pm2 monit

# Restart application
pm2 restart chillfi3

# Check for memory leaks
node --inspect server.js
```

**Database queries slow**
```bash
# Enable slow query log
mysql -e "SET GLOBAL slow_query_log = 'ON';"
mysql -e "SET GLOBAL long_query_time = 2;"

# Check slow queries
sudo tail -f /var/log/mysql/mysql-slow.log

# Add database indexes
mysql musiclib -e "SHOW INDEX FROM songs;"
```

## Network Issues

### SSL/HTTPS Issues

**SSL certificate errors**
```bash
# Check certificate validity
openssl x509 -in /path/to/cert.crt -text -noout

# Test SSL configuration
openssl s_client -connect your-domain.com:443

# Check certificate chain
curl -I https://your-domain.com
```

**Mixed content warnings**
```bash
# Check API_URL in .env.client
grep API_URL .env.client

# Ensure all URLs use HTTPS
# Update .env.client:
echo "API_URL=https://your-domain.com/api" > .env.client
```

**Let's Encrypt renewal fails**
```bash
# Test renewal
sudo certbot renew --dry-run

# Check certbot logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log

# Manual renewal
sudo certbot renew --force-renewal
```

### Firewall Issues

**Can't access application**
```bash
# Check firewall status
sudo ufw status

# Allow HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Check iptables
sudo iptables -L
```

**API requests blocked**
```bash
# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check rate limiting
grep "limiting requests" /var/log/nginx/error.log

# Adjust rate limits in nginx config
```

## Browser Issues

### Client-Side Errors

**JavaScript errors in console**
```javascript
// Check browser console (F12)
// Common errors:

// CORS errors
// Solution: Check API_URL in .env.client

// Module loading errors
// Solution: Clear browser cache

// WebSocket connection failed
// Solution: Check server is running on correct port
```

**Audio playback issues**
```bash
# Check audio file formats
file uploads/*.mp3

# Check browser audio support
# Test in different browsers

# Check S3 CORS configuration
aws s3api get-bucket-cors --bucket your-bucket-name
```

**Upload progress stuck**
```bash
# Check browser network tab
# Look for failed requests

# Check server logs
pm2 logs chillfi3

# Clear browser cache and cookies
```

## Debugging Tools

### Log Analysis

**Server logs**
```bash
# PM2 logs
pm2 logs chillfi3 --lines 100

# Application logs
tail -f /var/log/chillfi3/combined.log

# Error logs only
pm2 logs chillfi3 --err
```

**Database logs**
```bash
# MySQL error log
sudo tail -f /var/log/mysql/error.log

# Query log
mysql -e "SET GLOBAL general_log = 'ON';"
sudo tail -f /var/log/mysql/mysql.log
```

**Web server logs**
```bash
# Nginx access log
sudo tail -f /var/log/nginx/access.log

# Nginx error log
sudo tail -f /var/log/nginx/error.log

# Filter by IP
grep "192.168.1.100" /var/log/nginx/access.log
```

### System Monitoring

**Resource usage**
```bash
# CPU and memory
htop

# Disk usage
df -h
du -sh /path/to/chillfi3/*

# Network connections
netstat -tulpn | grep :3005
```

**Process monitoring**
```bash
# Node.js processes
ps aux | grep node

# Database processes
ps aux | grep mysql

# Web server processes
ps aux | grep nginx
```

### Database Debugging

**Connection testing**
```bash
# Test connection
mysql -h localhost -u musiclib -p -e "SELECT 1;"

# Check database size
mysql musiclib -e "SELECT table_name, ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)' FROM information_schema.tables WHERE table_schema = 'musiclib';"

# Check table status
mysql musiclib -e "SHOW TABLE STATUS;"
```

**Query debugging**
```sql
-- Enable query profiling
SET profiling = 1;

-- Run your query
SELECT * FROM songs WHERE title LIKE '%test%';

-- Show profile
SHOW PROFILES;
SHOW PROFILE FOR QUERY 1;
```

## Getting Help

### Information to Collect

When reporting issues, include:

1. **System information**
   ```bash
   uname -a
   node --version
   npm --version
   docker --version
   ```

2. **Application logs**
   ```bash
   pm2 logs chillfi3 --lines 50
   ```

3. **Error messages**
   - Browser console errors
   - Server error logs
   - Database error logs

4. **Configuration**
   - Environment variables (without secrets)
   - Nginx configuration
   - Docker compose files

### Support Channels

- **GitHub Issues**: https://github.com/richardred15/chillfi3/issues
- **Documentation**: Check all docs/ files
- **Server logs**: Always check logs first

### Emergency Recovery

**Complete system recovery**
```bash
# Stop all services
docker-compose down
# or
pm2 stop all
sudo systemctl stop nginx mysql

# Restore from backup
# (See production.md backup section)

# Start services
docker-compose up -d
# or
sudo systemctl start mysql nginx
pm2 start all
```

**Database corruption recovery**
```bash
# Check database integrity
mysql musiclib -e "CHECK TABLE songs, albums, artists, users;"

# Repair tables if needed
mysql musiclib -e "REPAIR TABLE songs;"

# Restore from backup if repair fails
mysql musiclib < /path/to/backup.sql
```