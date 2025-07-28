# Configuration Examples

This directory contains example configuration files for ChillFi3 deployment.

## Nginx Configurations

### `nginx.conf`
Basic nginx configuration for development/testing environments.
- HTTP only
- Basic security headers
- API proxy with HTTPS backend support
- File upload handling

### `nginx-production.conf`
Production-ready nginx configuration with:
- HTTPS/SSL termination
- Security headers and CSP
- Rate limiting for different endpoints
- Gzip compression
- Static file caching
- Enhanced security restrictions

## Systemd Service

### `systemd/chillfi3.service`
Production systemd service file with:
- Security restrictions and sandboxing
- Automatic restart on failure
- Resource limits
- Proper logging configuration

## Usage

### Nginx Setup
```bash
# Copy configuration
sudo cp nginx-production.conf /etc/nginx/sites-available/chillfi3
sudo ln -s /etc/nginx/sites-available/chillfi3 /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### Systemd Service Setup
```bash
# Copy service file
sudo cp systemd/chillfi3.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable chillfi3
sudo systemctl start chillfi3

# Check status
sudo systemctl status chillfi3
```

## Customization

Before using these configurations:

1. **Update paths**: Replace `/path/to/chillfi3` with your actual installation path
2. **Update domain**: Replace `your-domain.com` with your actual domain
3. **SSL certificates**: Update SSL certificate paths in production config
4. **User/group**: Ensure `chillfi3` user and `www-data` group exist
5. **PHP version**: Update PHP-FPM socket path if using different PHP version

## Security Notes

- The production nginx config includes comprehensive security headers
- Rate limiting is configured for different endpoint types
- The systemd service runs with restricted privileges
- SSL/TLS is configured with modern security standards
- Sensitive files and directories are blocked from web access