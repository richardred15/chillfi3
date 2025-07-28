# Security Guide

Security best practices and hardening guide for ChillFi3.

## Security Overview

ChillFi3 implements multiple security layers:
- **Authentication**: JWT-based user authentication
- **Authorization**: Role-based access control
- **Input Validation**: SQL injection and XSS protection
- **Transport Security**: HTTPS/TLS encryption
- **Rate Limiting**: API abuse prevention
- **File Security**: Upload validation and sandboxing

## Authentication Security

### JWT Configuration

**Strong JWT Secret**
```bash
# Generate cryptographically secure secret
openssl rand -base64 64

# Add to server/.env
JWT_SECRET=your_64_character_random_string_here
```

**Token Security Settings**
```env
# server/.env
JWT_SECRET=your_secure_secret_here
TOKEN_EXPIRY=24h  # Shorter for production
```

### Password Security

**Password Requirements**
- Minimum 8 characters
- Bcrypt hashing with salt rounds 10+
- No password reuse
- Regular password rotation

**Implementation**
```javascript
// Strong password validation
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// Secure hashing
const saltRounds = 12;
const hashedPassword = await bcrypt.hash(password, saltRounds);
```

### Session Management

**Session Security**
```env
# Secure session settings
SESSION_SECURE=true
SESSION_HTTPONLY=true
SESSION_SAMESITE=strict
```

**Session Cleanup**
```sql
-- Remove expired sessions
DELETE FROM sessions WHERE expires_at < NOW();

-- Clear all sessions for user
DELETE FROM sessions WHERE user_id = ?;
```

## Input Validation & Sanitization

### SQL Injection Prevention

**Parameterized Queries** (Already implemented)
```javascript
// ✅ Secure - parameterized
const songs = await database.query(
    'SELECT * FROM songs WHERE title = ?',
    [userInput]
);

// ❌ Vulnerable - string concatenation
const songs = await database.query(
    `SELECT * FROM songs WHERE title = '${userInput}'`
);
```

### XSS Prevention

**HTML Sanitization**
```javascript
// Sanitize user input
function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Use in templates
const safeTitle = sanitizeHTML(song.title);
```

**Content Security Policy**
```javascript
// server.js - Already implemented
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "wss:", "https:"]
        }
    }
}));
```

### File Upload Security

**File Type Validation**
```javascript
const allowedTypes = [
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/flac'
];

const allowedExtensions = ['.mp3', '.m4a', '.wav', '.flac'];

function validateFileType(file) {
    const extension = path.extname(file.originalname).toLowerCase();
    return allowedTypes.includes(file.mimetype) && 
           allowedExtensions.includes(extension);
}
```

**File Size Limits**
```env
# server/.env
MAX_FILE_SIZE=104857600  # 100MB
CHUNK_SIZE=524288        # 512KB
```

**File Scanning**
```bash
# Install ClamAV for virus scanning
sudo apt install clamav clamav-daemon

# Scan uploaded files
clamscan /path/to/uploaded/file
```

## Network Security

### HTTPS Configuration

**SSL/TLS Settings**
```nginx
# Strong SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# HSTS
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
```

**Certificate Management**
```bash
# Let's Encrypt with auto-renewal
sudo certbot --nginx -d your-domain.com
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -

# Check certificate expiration
openssl x509 -in /etc/letsencrypt/live/your-domain.com/cert.pem -noout -dates
```

### Firewall Configuration

**UFW Firewall Rules**
```bash
# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow essential services
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Limit SSH attempts
sudo ufw limit ssh

# Enable firewall
sudo ufw enable
```

**Advanced iptables Rules**
```bash
# Block common attack patterns
sudo iptables -A INPUT -p tcp --dport 80 -m string --string "admin" --algo bm -j DROP
sudo iptables -A INPUT -p tcp --dport 80 -m string --string "phpmyadmin" --algo bm -j DROP

# Rate limiting
sudo iptables -A INPUT -p tcp --dport 80 -m limit --limit 25/minute --limit-burst 100 -j ACCEPT
```

### Rate Limiting

**Application-Level Rate Limiting**
```javascript
// Already implemented in server.js
const rateLimiter = new Map();
const RATE_LIMIT = { requests: 60, window: 60000 };

function checkRateLimit(clientIp) {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT.window;
    
    if (!rateLimiter.has(clientIp)) {
        rateLimiter.set(clientIp, []);
    }
    
    const requests = rateLimiter.get(clientIp);
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= RATE_LIMIT.requests) {
        return false; // Rate limited
    }
    
    validRequests.push(now);
    rateLimiter.set(clientIp, validRequests);
    return true;
}
```

**Nginx Rate Limiting**
```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=upload:10m rate=2r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

# Apply limits
location /api/ {
    limit_req zone=api burst=20 nodelay;
}

location /api/upload {
    limit_req zone=upload burst=5 nodelay;
}

location /api/auth/login {
    limit_req zone=login burst=3 nodelay;
}
```

## Database Security

### Database Hardening

**MySQL Security Configuration**
```sql
-- Remove anonymous users
DELETE FROM mysql.user WHERE User='';

-- Remove remote root access
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');

-- Remove test database
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';

-- Set secure passwords
ALTER USER 'root'@'localhost' IDENTIFIED BY 'secure_root_password';
ALTER USER 'musiclib'@'localhost' IDENTIFIED BY 'secure_musiclib_password';

-- Reload privileges
FLUSH PRIVILEGES;
```

**Database User Permissions**
```sql
-- Create limited user for application
CREATE USER 'chillfi3_app'@'localhost' IDENTIFIED BY 'secure_app_password';

-- Grant only necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON musiclib.* TO 'chillfi3_app'@'localhost';

-- No administrative privileges
REVOKE ALL PRIVILEGES ON mysql.* FROM 'chillfi3_app'@'localhost';
```

### Connection Security

**SSL Database Connections**
```env
# server/.env
DB_SSL=true
DB_SSL_CA=/path/to/ca-cert.pem
DB_SSL_CERT=/path/to/client-cert.pem
DB_SSL_KEY=/path/to/client-key.pem
```

**Connection Limits**
```sql
-- Limit concurrent connections per user
ALTER USER 'chillfi3_app'@'localhost' WITH MAX_USER_CONNECTIONS 50;
```

## Server Hardening

### System Security

**User Account Security**
```bash
# Create dedicated user
sudo useradd -m -s /bin/bash chillfi3
sudo usermod -aG www-data chillfi3

# Disable password login for service account
sudo passwd -l chillfi3

# Set proper file permissions
sudo chown -R chillfi3:www-data /home/chillfi3/app
sudo chmod -R 750 /home/chillfi3/app
sudo chmod 600 /home/chillfi3/app/server/.env
```

**SSH Hardening**
```bash
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
Protocol 2
ClientAliveInterval 300
ClientAliveCountMax 2
MaxAuthTries 3
```

### Process Security

**Service Isolation**
```bash
# Systemd service with security restrictions
sudo tee /etc/systemd/system/chillfi3.service << EOF
[Unit]
Description=ChillFi3 Music Server
After=network.target mysql.service

[Service]
Type=simple
User=chillfi3
Group=www-data
WorkingDirectory=/home/chillfi3/app/server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

# Security restrictions
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/home/chillfi3/app
CapabilityBoundingSet=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF
```

## Monitoring & Intrusion Detection

### Log Monitoring

**Security Log Analysis**
```bash
# Monitor authentication attempts
sudo tail -f /var/log/auth.log | grep "Failed password"

# Monitor web server attacks
sudo tail -f /var/log/nginx/access.log | grep -E "(404|403|500)"

# Monitor application errors
pm2 logs chillfi3 | grep -i error
```

**Automated Log Analysis**
```bash
# Install logwatch
sudo apt install logwatch

# Configure daily reports
sudo tee /etc/logwatch/conf/logwatch.conf << EOF
LogDir = /var/log
TmpDir = /var/cache/logwatch
MailTo = admin@your-domain.com
MailFrom = logwatch@your-domain.com
Print = No
Range = yesterday
Detail = Med
Service = All
EOF
```

### Intrusion Detection

**Fail2Ban Configuration**
```bash
# Install fail2ban
sudo apt install fail2ban

# Configure jails
sudo tee /etc/fail2ban/jail.d/chillfi3.conf << EOF
[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
bantime = 3600
findtime = 600

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
bantime = 600
findtime = 600

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
EOF

sudo systemctl restart fail2ban
```

**OSSEC Integration**
```bash
# Install OSSEC HIDS
wget https://github.com/ossec/ossec-hids/archive/3.7.0.tar.gz
tar -xzf 3.7.0.tar.gz
cd ossec-hids-3.7.0
sudo ./install.sh

# Configure for ChillFi3
sudo tee -a /var/ossec/etc/ossec.conf << EOF
<localfile>
  <log_format>apache</log_format>
  <location>/var/log/nginx/access.log</location>
</localfile>

<localfile>
  <log_format>apache</log_format>
  <location>/var/log/nginx/error.log</location>
</localfile>
EOF
```

## Backup Security

### Encrypted Backups

**Database Backup Encryption**
```bash
# Encrypted database backup
mysqldump --single-transaction musiclib | \
gpg --cipher-algo AES256 --compress-algo 1 --symmetric --output backup_$(date +%Y%m%d).sql.gpg

# Restore encrypted backup
gpg --decrypt backup_20240101.sql.gpg | mysql musiclib
```

**File Backup Encryption**
```bash
# Encrypted file backup
tar -czf - /home/chillfi3/app/uploads | \
gpg --cipher-algo AES256 --compress-algo 1 --symmetric --output files_$(date +%Y%m%d).tar.gz.gpg
```

### Secure Backup Storage

**Remote Backup with rsync**
```bash
# Secure remote backup
rsync -avz --delete -e "ssh -i /home/chillfi3/.ssh/backup_key" \
/home/chillfi3/backups/ backup@remote-server:/backups/chillfi3/
```

## Incident Response

### Security Incident Checklist

1. **Immediate Response**
   - [ ] Isolate affected systems
   - [ ] Preserve evidence
   - [ ] Document timeline
   - [ ] Notify stakeholders

2. **Investigation**
   - [ ] Analyze logs
   - [ ] Identify attack vector
   - [ ] Assess damage
   - [ ] Collect forensic data

3. **Containment**
   - [ ] Block malicious IPs
   - [ ] Patch vulnerabilities
   - [ ] Reset compromised credentials
   - [ ] Update security rules

4. **Recovery**
   - [ ] Restore from clean backups
   - [ ] Verify system integrity
   - [ ] Monitor for reinfection
   - [ ] Update documentation

### Emergency Contacts

```bash
# Create incident response script
cat > /home/chillfi3/incident-response.sh << 'EOF'
#!/bin/bash
echo "SECURITY INCIDENT DETECTED: $(date)"

# Stop services
pm2 stop chillfi3
sudo systemctl stop nginx

# Block all traffic except admin
sudo iptables -I INPUT 1 -s YOUR_ADMIN_IP -j ACCEPT
sudo iptables -I INPUT 2 -j DROP

# Backup current state for forensics
mysqldump musiclib > /tmp/incident_db_$(date +%Y%m%d_%H%M%S).sql
tar -czf /tmp/incident_logs_$(date +%Y%m%d_%H%M%S).tar.gz /var/log/

# Send alert
echo "Security incident detected on ChillFi3 server" | \
mail -s "URGENT: Security Incident" admin@your-domain.com

echo "Incident response initiated. Check /tmp/ for forensic data."
EOF

chmod +x /home/chillfi3/incident-response.sh
```

## Security Checklist

### Pre-Deployment Security Audit

- [ ] Strong passwords for all accounts
- [ ] JWT secret is cryptographically secure
- [ ] HTTPS properly configured
- [ ] Database access restricted
- [ ] File upload validation implemented
- [ ] Rate limiting configured
- [ ] Firewall rules applied
- [ ] Security headers enabled
- [ ] Logging configured
- [ ] Backup encryption enabled
- [ ] Monitoring tools installed
- [ ] Incident response plan ready

### Regular Security Maintenance

**Weekly Tasks**
- [ ] Review security logs
- [ ] Check for failed login attempts
- [ ] Monitor system resources
- [ ] Verify backup integrity

**Monthly Tasks**
- [ ] Update system packages
- [ ] Review user accounts
- [ ] Test backup restoration
- [ ] Security scan with tools

**Quarterly Tasks**
- [ ] Security audit
- [ ] Penetration testing
- [ ] Update security documentation
- [ ] Review incident response plan

### Security Tools

**Vulnerability Scanning**
```bash
# Install Nmap for network scanning
sudo apt install nmap

# Scan for open ports
nmap -sS -O localhost

# Install Nikto for web vulnerability scanning
sudo apt install nikto

# Scan web application
nikto -h https://your-domain.com
```

**SSL Testing**
```bash
# Test SSL configuration
curl -I https://your-domain.com

# Use SSL Labs online test
# https://www.ssllabs.com/ssltest/
```