#!/bin/bash

# ChillFi3 Docker Installation Script
# This script will guide you through setting up ChillFi3 with Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}$1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as a regular user."
   exit 1
fi

print_header "=== ChillFi3 Docker Installation ==="
echo
print_status "This script will:"
echo "  1. Install Docker and Docker Compose"
echo "  2. Configure environment files"
echo "  3. Set up ChillFi3 services"
echo "  4. Create your admin user"
echo

read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# Step 1: Install Docker
print_header "\n=== Step 1: Installing Docker ==="

if command -v docker &> /dev/null; then
    print_status "Docker is already installed"
    docker --version
else
    print_status "Installing Docker..."
    sudo apt update
    sudo apt install -y docker.io docker-compose
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    print_warning "You'll need to log out and back in for Docker permissions to take effect"
    print_status "Or run: newgrp docker"
fi

if command -v docker-compose &> /dev/null; then
    print_status "Docker Compose is ready"
    docker-compose --version
else
    print_error "Docker Compose installation failed"
    exit 1
fi

# Step 2: Environment Configuration
print_header "\n=== Step 2: Environment Configuration ==="

# Server environment
print_status "Configuring server environment..."

if [[ ! -f "server/.env" ]]; then
    cp server/.env.example server/.env
    print_status "Created server/.env from example"
fi

# Prompt for configuration
echo
print_header "Database Configuration:"
read -p "Database password (leave empty for auto-generated): " DB_PASSWORD
if [[ -z "$DB_PASSWORD" ]]; then
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    print_status "Generated database password: $DB_PASSWORD"
fi

echo
print_header "AWS S3 Configuration (Required for file storage):"
echo "You need an AWS S3 bucket for storing music files and images."
echo "Visit: https://console.aws.amazon.com/s3/"
echo

read -p "AWS Access Key ID: " AWS_ACCESS_KEY_ID
read -p "AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY
read -p "S3 Bucket Name: " S3_BUCKET_NAME
read -p "AWS Region (default: us-west-2): " AWS_REGION
AWS_REGION=${AWS_REGION:-us-west-2}

echo
print_header "Application Configuration:"
read -p "App Name (default: ChillFi3): " APP_NAME
APP_NAME=${APP_NAME:-ChillFi3}

read -p "Domain name (for production, leave empty for localhost): " DOMAIN_NAME

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-50)

# Update server/.env
cat > server/.env << EOF
# Database Configuration
DB_HOST=db
DB_USER=musiclib
DB_PASSWORD=$DB_PASSWORD
DB_NAME=musiclib
DB_PORT=3306

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
S3_BUCKET_NAME=$S3_BUCKET_NAME
AWS_REGION=$AWS_REGION

# Application Configuration
JWT_SECRET=$JWT_SECRET
PORT=3005
NODE_ENV=development

# Logging
LOG_LEVEL=info
LOG_FILE=logs/chillfi3.log
EOF

# Update client environment
if [[ -n "$DOMAIN_NAME" ]]; then
    API_URL="https://$DOMAIN_NAME/api"
else
    API_URL="http://localhost:3005/api"
fi

cat > .env.client << EOF
APP_NAME=$APP_NAME
API_URL=$API_URL
EOF

print_status "Environment files configured"

# Step 3: Docker Compose Setup
print_header "\n=== Step 3: Setting up Docker services ==="

# Set environment variables for docker-compose
export DB_PASSWORD
export DB_ROOT_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

print_status "Building and starting services..."
docker-compose down 2>/dev/null || true
docker-compose build
docker-compose up -d

print_status "Waiting for services to start..."
sleep 15

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    print_status "Services are running"
else
    print_error "Some services failed to start. Check logs with: docker-compose logs"
    exit 1
fi

# Step 4: Create Admin User
print_header "\n=== Step 4: Creating Admin User ==="

echo
read -p "Admin username: " ADMIN_USERNAME
read -s -p "Admin password: " ADMIN_PASSWORD
echo

if [[ -z "$ADMIN_USERNAME" || -z "$ADMIN_PASSWORD" ]]; then
    print_error "Username and password are required"
    exit 1
fi

print_status "Creating admin user..."
echo "create-admin $ADMIN_USERNAME $ADMIN_PASSWORD" | docker-compose exec -T app sh -c "cd /app/server && node server.js"

# Step 5: Final Instructions
print_header "\n=== Installation Complete! ==="
echo
print_status "ChillFi3 is now running!"
echo
echo "Access your music library at:"
if [[ -n "$DOMAIN_NAME" ]]; then
    echo "  https://$DOMAIN_NAME"
else
    echo "  http://localhost"
fi
echo
echo "Admin credentials:"
echo "  Username: $ADMIN_USERNAME"
echo "  Password: [hidden]"
echo
print_header "Next Steps:"
echo "1. Log in with your admin credentials"
echo "2. Upload your music files"
echo "3. Configure additional users if needed"
echo
print_header "Useful Commands:"
echo "  View logs:     docker-compose logs -f"
echo "  Stop services: docker-compose down"
echo "  Start services: docker-compose up -d"
echo "  Update app:    git pull && docker-compose build && docker-compose up -d"
echo
print_status "Enjoy your private music library!"