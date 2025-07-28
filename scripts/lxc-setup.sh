#!/bin/bash
# ChillFi3 LXC Container Setup Script

set -e

CONTAINER_NAME="chillfi3"
TEMPLATE="ubuntu:22.04"
PROFILE="default"

echo "🚀 Setting up ChillFi3 LXC container..."

# Create LXC container
echo "📦 Creating LXC container..."
lxc launch $TEMPLATE $CONTAINER_NAME -p $PROFILE

# Wait for container to start
echo "⏳ Waiting for container to start..."
sleep 10

# Update system
echo "🔄 Updating system packages..."
lxc exec $CONTAINER_NAME -- apt update
lxc exec $CONTAINER_NAME -- apt upgrade -y

# Install dependencies
echo "📥 Installing dependencies..."
lxc exec $CONTAINER_NAME -- apt install -y \
    curl \
    wget \
    git \
    nginx \
    php8.1-fpm \
    php8.1-mysql \
    php8.1-curl \
    php8.1-json \
    mysql-server \
    supervisor

# Install Node.js
echo "📦 Installing Node.js..."
lxc exec $CONTAINER_NAME -- curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
lxc exec $CONTAINER_NAME -- apt install -y nodejs

# Create app directory
lxc exec $CONTAINER_NAME -- mkdir -p /var/www/chillfi3

# Copy application files
echo "📁 Copying application files..."
lxc file push -r . $CONTAINER_NAME/var/www/chillfi3/

# Set permissions
lxc exec $CONTAINER_NAME -- chown -R www-data:www-data /var/www/chillfi3
lxc exec $CONTAINER_NAME -- chmod +x /var/www/chillfi3/server/server.js

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
lxc exec $CONTAINER_NAME -- bash -c "cd /var/www/chillfi3/server && npm install"

# Configure MySQL
echo "🗄️ Configuring MySQL..."
lxc exec $CONTAINER_NAME -- mysql -e "CREATE DATABASE IF NOT EXISTS musiclib;"
lxc exec $CONTAINER_NAME -- mysql -e "CREATE USER IF NOT EXISTS 'musiclib'@'localhost' IDENTIFIED BY 'musiclib_password';"
lxc exec $CONTAINER_NAME -- mysql -e "GRANT ALL PRIVILEGES ON musiclib.* TO 'musiclib'@'localhost';"
lxc exec $CONTAINER_NAME -- mysql -e "FLUSH PRIVILEGES;"

# Configure Nginx
echo "🌐 Configuring Nginx..."
lxc file push docker/nginx.conf $CONTAINER_NAME/etc/nginx/sites-available/chillfi3
lxc exec $CONTAINER_NAME -- ln -sf /etc/nginx/sites-available/chillfi3 /etc/nginx/sites-enabled/
lxc exec $CONTAINER_NAME -- rm -f /etc/nginx/sites-enabled/default

# Configure Supervisor
echo "👮 Configuring Supervisor..."
lxc file push docker/supervisord.conf $CONTAINER_NAME/etc/supervisor/conf.d/chillfi3.conf

# Configure environment
echo "⚙️ Setting up environment..."
lxc file push server/.env.example $CONTAINER_NAME/var/www/chillfi3/server/.env
lxc file push .env.client $CONTAINER_NAME/var/www/chillfi3/.env.client

# Start services
echo "🚀 Starting services..."
lxc exec $CONTAINER_NAME -- systemctl enable nginx php8.1-fpm mysql supervisor
lxc exec $CONTAINER_NAME -- systemctl start nginx php8.1-fpm mysql supervisor

# Get container IP
CONTAINER_IP=$(lxc info $CONTAINER_NAME | grep -E "inet\s" | grep -v "127.0.0.1" | head -1 | awk '{print $2}' | cut -d'/' -f1)

echo "✅ ChillFi3 LXC container setup complete!"
echo "🌐 Access your application at: http://$CONTAINER_IP"
echo "📝 Container name: $CONTAINER_NAME"
echo ""
echo "Next steps:"
echo "1. Configure server/.env with your database credentials"
echo "2. Run database setup: lxc exec $CONTAINER_NAME -- bash -c 'cd /var/www/chillfi3/server && npm start'"
echo "3. Create admin user using the CLI interface"