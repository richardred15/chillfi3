# Multi-stage build for ChillFi3
FROM node:18-alpine AS server-deps

# Install server dependencies
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --only=production

# Production image
FROM php:8.2-fpm-alpine

# Install system dependencies
RUN apk add --no-cache \
    nginx \
    supervisor \
    mysql-client \
    nodejs \
    npm

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_mysql

# Copy server files and dependencies
WORKDIR /app
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY client/ ./client/
COPY *.php ./
COPY *.js ./

# Copy .env.client if it exists, otherwise copy example
COPY .env.client* ./
RUN if [ ! -f .env.client ]; then cp .env.client.example .env.client 2>/dev/null || echo 'APP_NAME=ChillFi3' > .env.client; fi

# Copy configuration files
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/php-fpm.conf /usr/local/etc/php-fpm.d/www.conf

# Create necessary directories
RUN mkdir -p /var/log/supervisor /run/nginx /var/tmp/nginx

# Set permissions
RUN chown -R www-data:www-data /app
RUN chmod +x /app/server/server.js

# Expose ports
EXPOSE 80 3005

# Create startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "Waiting for database..."' >> /app/start.sh && \
    echo 'sleep 10' >> /app/start.sh && \
    echo 'cd /app/server' >> /app/start.sh && \
    echo 'echo "setup-database" | timeout 30 node server.js || echo "Database setup completed or already exists"' >> /app/start.sh && \
    echo 'supervisord -c /etc/supervisor/conf.d/supervisord.conf' >> /app/start.sh && \
    chmod +x /app/start.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/api/health || exit 1

# Start with database initialization
CMD ["/app/start.sh"]