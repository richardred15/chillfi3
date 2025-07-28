# Installation Guide

Complete installation instructions for ChillFi3.

## System Requirements

### Minimum Requirements
- **OS:** Ubuntu 20.04+, CentOS 8+, or Docker
- **CPU:** 1 core, 2GB RAM
- **Storage:** 10GB + music storage
- **Network:** Internet access for dependencies

### Recommended Requirements
- **OS:** Ubuntu 22.04 LTS
- **CPU:** 2+ cores, 4GB+ RAM
- **Storage:** SSD with 50GB+ free space
- **Network:** Static IP for production

## Installation Methods

### Method 1: Docker (Recommended)

**Prerequisites:**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin
```

**Installation:**
```bash
# Clone repository
git clone https://github.com/richardred15/chillfi3.git
cd chillfi3

# Configure environment
cp server/.env.example server/.env
cp .env.client.example .env.client

# Edit configuration files
nano server/.env
nano .env.client

# Deploy
npm run docker:build
npm run docker:run
```

### Method 2: Manual Installation

**Prerequisites:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm php8.1-fpm nginx mysql-server

# CentOS/RHEL
sudo yum install nodejs npm php-fpm nginx mysql-server
```

**Installation:**
```bash
# Clone repository
git clone https://github.com/richardred15/chillfi3.git
cd chillfi3

# Install server dependencies
cd server
npm install
cd ..

# Configure environment
cp server/.env.example server/.env
cp .env.client.example .env.client

# Setup database
sudo mysql -e "CREATE DATABASE musiclib;"
sudo mysql -e "CREATE USER 'musiclib'@'localhost' IDENTIFIED BY 'your_password';"
sudo mysql -e "GRANT ALL PRIVILEGES ON musiclib.* TO 'musiclib'@'localhost';"

# Configure web server
sudo cp docs/examples/nginx.conf /etc/nginx/sites-available/chillfi3
sudo ln -s /etc/nginx/sites-available/chillfi3 /etc/nginx/sites-enabled/
sudo systemctl restart nginx php8.1-fpm

# Start application
cd server
npm start
```

### Method 3: LXC Container

```bash
# Make script executable
chmod +x scripts/lxc-setup.sh

# Run setup script
sudo ./scripts/lxc-setup.sh
```

## Post-Installation

### 1. Database Setup
```bash
# Docker
docker exec -it chillfi3-app-1 bash -c "cd server && echo 'setup-database' | node server.js"

# Manual
cd server
echo "setup-database" | node server.js
```

### 2. Create Admin User
```bash
# Docker
docker exec -it chillfi3-app-1 bash -c "cd server && echo 'create-admin admin password123' | node server.js"

# Manual
cd server
echo "create-admin admin password123" | node server.js
```

### 3. Configure Firewall
```bash
# Allow HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 4. Setup SSL (Optional)
See [HTTPS Setup Guide](https.md) for SSL configuration.

## Verification

1. **Check services:**
   ```bash
   # Docker
   docker ps
   
   # Manual
   systemctl status nginx php8.1-fpm mysql
   ```

2. **Test application:**
   - Open http://your-server-ip
   - Login with admin credentials
   - Upload a test music file

## Next Steps

- [Configuration Guide](configuration.md)
- [User Management](user-management.md)
- [Production Setup](production.md)