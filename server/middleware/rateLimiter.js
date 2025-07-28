/**
 * Rate Limiting Middleware
 */
const redisService = require('../services/redisService');

const rateLimits = new Map(); // Fallback for when Redis unavailable

const LIMITS = {
    'song:upload': { requests: 50, window: 60000 }, // 50 upload chunks per minute
    'song:uploadInit': { requests: 10, window: 60000 }, // 10 upload sessions per minute
    'song:uploadChunk': { requests: 200, window: 60000 }, // 200 chunks per minute
    'song:list': { requests: 30, window: 60000 },  // 30 requests per minute
    'song:search': { requests: 50, window: 60000 }, // 50 search requests per minute
    'auth:login': { requests: 5, window: 900000 }, // 5 login attempts per 15 minutes
    'auth:createUser': { requests: 2, window: 3600000 }, // 2 user creations per hour
    'user:update': { requests: 5, window: 60000 }, // 5 updates per minute
    'song:update': { requests: 10, window: 60000 }, // 10 updates per minute
    'default': { requests: 30, window: 60000 }      // 30 requests per minute default
};

// IP-based global rate limiting
const IP_LIMIT = { requests: 1000, window: 3600000 }; // 1000 requests per hour per IP

function getRateLimit(eventName) {
    return LIMITS[eventName] || LIMITS.default;
}

async function rateLimiter(socket, eventName) {
    const clientId = socket.handshake.address;
    const userId = socket.user?.id || clientId;
    
    const keyId = eventName === 'auth:login' ? clientId : userId;
    const userKey = `rate:${keyId}:${eventName}`;
    const ipKey = `rate:ip:${clientId}`;
    
    const limit = getRateLimit(eventName);
    
    // Try Redis first, fallback to memory
    if (redisService.isConnected()) {
        const userAllowed = await redisService.checkRateLimit(userKey, limit.requests, Math.floor(limit.window / 1000));
        if (!userAllowed) {
            console.warn(`Rate limit exceeded for ${eventName === 'auth:login' ? 'IP' : 'user'} ${keyId} on ${eventName}`);
            return false;
        }
        
        if (eventName !== 'auth:login') {
            const ipAllowed = await redisService.checkRateLimit(ipKey, IP_LIMIT.requests, Math.floor(IP_LIMIT.window / 1000));
            if (!ipAllowed) {
                console.warn(`IP rate limit exceeded for ${clientId}`);
                return false;
            }
        }
        
        return true;
    } else {
        // Fallback to memory-based rate limiting
        const now = Date.now();
        
        if (!checkLimit(userKey, limit, now)) {
            console.warn(`Rate limit exceeded for ${eventName === 'auth:login' ? 'IP' : 'user'} ${keyId} on ${eventName}`);
            return false;
        }
        
        if (eventName !== 'auth:login' && !checkLimit(ipKey, IP_LIMIT, now)) {
            console.warn(`IP rate limit exceeded for ${clientId}`);
            return false;
        }
        
        return true;
    }
}

function checkLimit(key, limit, now) {
    const windowStart = now - limit.window;
    
    if (!rateLimits.has(key)) {
        rateLimits.set(key, []);
    }
    
    const requests = rateLimits.get(key);
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= limit.requests) {
        return false;
    }
    
    validRequests.push(now);
    rateLimits.set(key, validRequests);
    return true;
}

// Clean up old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    
    for (const [key, requests] of rateLimits.entries()) {
        const validRequests = requests.filter(timestamp => timestamp > now - maxAge);
        if (validRequests.length === 0) {
            rateLimits.delete(key);
        } else {
            rateLimits.set(key, validRequests);
        }
    }
}, 300000);

module.exports = rateLimiter;