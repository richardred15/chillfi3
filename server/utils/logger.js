/**
 * Winston Logging Configuration
 */
const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, userId, socketId, error, ...meta }) => {
        let output = `[${timestamp}] ${level}: ${message}`;
        
        if (userId) output += ` [User: ${userId}]`;
        if (socketId) output += ` [Socket: ${socketId.substring(0, 8)}]`;
        if (error) output += ` [Error: ${error}]`;
        
        const remainingMeta = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return output + remainingMeta;
    })
);

// Custom format for file output with structured data
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, userId, socketId, error, stack, ...meta }) => {
        const logEntry = {
            timestamp,
            level,
            message,
            ...(userId && { userId }),
            ...(socketId && { socketId }),
            ...(error && { error }),
            ...(stack && { stack }),
            ...meta
        };
        return JSON.stringify(logEntry);
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL?.toLowerCase() || 'info',
    format: fileFormat,
    transports: [
        // Error log file - only errors with full stack traces
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5
        }),
        // Application log - info and above with structured data
        new winston.transports.File({
            filename: path.join(logDir, 'app.log'),
            level: 'info',
            maxsize: 10485760, // 10MB
            maxFiles: 5
        }),
        // Debug log - everything for troubleshooting
        new winston.transports.File({
            filename: path.join(logDir, 'debug.log'),
            level: 'debug',
            maxsize: 10485760, // 10MB
            maxFiles: 3
        })
    ]
});

// Add console transport for non-production
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat
    }));
} else {
    // In production, only log warnings and errors to console
    logger.add(new winston.transports.Console({
        level: 'warn',
        format: consoleFormat
    }));
}

module.exports = logger;