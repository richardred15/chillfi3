/**
 * Rate Limiting Middleware
 */

const rateLimits = new Map();

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

function rateLimiter(socket, eventName) {
    const clientId = socket.handshake.address;
    const userId = socket.user?.id || clientId; // Use IP for anonymous users
    
    // For login attempts, always use IP address
    const keyId = eventName === 'auth:login' ? clientId : userId;
    const userKey = `${keyId}:${eventName}`;
    const ipKey = `ip:${clientId}`;
    
    const limit = getRateLimit(eventName);
    const now = Date.now();
    
    // Check user-specific rate limit
    if (!checkLimit(userKey, limit, now)) {
        console.warn(`Rate limit exceeded for ${eventName === 'auth:login' ? 'IP' : 'user'} ${keyId} on ${eventName}`);
        return false;
    }
    
    // Check IP-based global rate limit (skip for login to avoid double-checking)
    if (eventName !== 'auth:login' && !checkLimit(ipKey, IP_LIMIT, now)) {
        console.warn(`IP rate limit exceeded for ${clientId}`);
        return false;
    }
    
    return true;
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