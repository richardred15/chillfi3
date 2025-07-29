/**
 * Redis Service for Caching and Sessions
 */
const redis = require('redis');
const config = require('../config');
const logger = require('../utils/logger');

class RedisService {
    constructor() {
        this.client = null;
        this.connected = false;
    }

    async connect() {
        try {
            this.client = redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: 3
            });

            this.client.on('error', (err) => {
                logger.error('Redis connection error', { error: err.message });
                this.connected = false;
            });

            this.client.on('connect', () => {
                logger.info('Redis connected successfully');
                this.connected = true;
            });

            await this.client.connect();
            return true;
        } catch (error) {
            logger.warn('Redis connection failed, continuing without cache', { error: error.message });
            this.connected = false;
            return false;
        }
    }

    async disconnect() {
        if (this.client && this.connected) {
            await this.client.disconnect();
            this.connected = false;
            logger.info('Redis disconnected');
        }
    }

    // Cache operations
    async get(key) {
        if (!this.connected) return null;
        try {
            return await this.client.get(key);
        } catch (error) {
            logger.error('Redis get error', { key, error: error.message });
            return null;
        }
    }

    async set(key, value, ttl = 3600) {
        if (!this.connected) return false;
        try {
            await this.client.setEx(key, ttl, value);
            return true;
        } catch (error) {
            logger.error('Redis set error', { key, error: error.message });
            return false;
        }
    }

    async del(key) {
        if (!this.connected) return false;
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            logger.error('Redis del error', { key, error: error.message });
            return false;
        }
    }

    // Rate limiting
    async checkRateLimit(key, limit, window) {
        if (!this.connected) return true; // Allow if Redis unavailable
        
        try {
            const current = await this.client.incr(key);
            if (current === 1) {
                await this.client.expire(key, window);
            }
            return current <= limit;
        } catch (error) {
            logger.error('Redis rate limit error', { key, error: error.message });
            return true; // Allow on error
        }
    }

    // Session storage
    async getSession(sessionId) {
        const data = await this.get(`session:${sessionId}`);
        return data ? JSON.parse(data) : null;
    }

    async setSession(sessionId, data, ttl = 86400) {
        return await this.set(`session:${sessionId}`, JSON.stringify(data), ttl);
    }

    async deleteSession(sessionId) {
        return await this.del(`session:${sessionId}`);
    }

    isConnected() {
        return this.connected;
    }

    // Clear all cache
    async flushAll() {
        if (!this.connected) return false;
        try {
            await this.client.flushAll();
            logger.info('Redis cache cleared');
            return true;
        } catch (error) {
            logger.error('Redis flush error', { error: error.message });
            return false;
        }
    }
}

// Create singleton instance
const redisService = new RedisService();

module.exports = redisService;