/**
 * Logging Utility
 */

const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

const currentLevel = process.env.LOG_LEVEL ? 
    LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] : 
    LOG_LEVELS.INFO;

function log(level, message, data = null) {
    if (LOG_LEVELS[level] <= currentLevel) {
        const timestamp = new Date().toISOString();
        const logData = data ? ` ${JSON.stringify(data)}` : '';
        console.log(`[${timestamp}] ${level}: ${message}${logData}`);
    }
}

module.exports = {
    error: (message, data) => log('ERROR', message, data),
    warn: (message, data) => log('WARN', message, data),
    info: (message, data) => log('INFO', message, data),
    debug: (message, data) => log('DEBUG', message, data)
};