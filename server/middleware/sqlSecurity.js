/**
 * SQL Security Middleware
 */

// WARNING: Pattern-based SQL injection detection can have false positives and negatives.
// Always use parameterized queries instead of relying solely on these patterns.

// Dangerous SQL patterns to detect (only in parameters, not queries)
const SQL_INJECTION_PATTERNS = [
    /(\b(DROP|CREATE|ALTER|EXEC|TRUNCATE|REPLACE)\b)/i,
    /(--|\/\*|\*\/|#)/,
    /(\bOR\b.*=.*\bOR\b)/i,
    /(\bUNION\b.*\bSELECT\b)/i,
    /;.*\b(SELECT|INSERT|UPDATE|DELETE|EXEC)\b/i,
    /(\bxp_|\bsp_|\bfn_)/i,
    /(\bSCRIPT\b|\bEVAL\b)/i,
    /('.*'.*=.*'.*')/,
    /(\b(WAITFOR|DELAY)\b)/i,
    /(\b(CAST|CONVERT)\b.*\()/i,
    /(\b(CHAR|ASCII|SUBSTRING)\b.*\()/i,
];

// Check for SQL injection patterns
function detectSQLInjection(input) {
    if (typeof input !== "string") return false;

    return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

// Sanitize database input
function sanitizeForDB(input) {
    if (typeof input !== "string") return input;

    // Remove dangerous characters
    return input
        .replace(/['"\\;]/g, "") // Remove quotes and semicolons
        .replace(/--/g, "") // Remove SQL comments
        .replace(/\/\*|\*\//g, "") // Remove block comments
        .trim();
}

// Validate JWT token format and content
function isValidJWT(token) {
    if (!token.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/)) {
        return false;
    }

    try {
        // Basic JWT structure validation
        const parts = token.split(".");
        if (parts.length !== 3) return false;

        // Decode header and payload to ensure they're valid JSON
        JSON.parse(Buffer.from(parts[0], "base64url").toString());
        JSON.parse(Buffer.from(parts[1], "base64url").toString());

        return true;
    } catch {
        return false;
    }
}

// Validate database query parameters
function validateQueryParams(params, context = "") {
    if (!Array.isArray(params)) return false;

    return params.every((param, index) => {
        if (typeof param === "string") {
            // Skip validation for valid JWT tokens in auth contexts only
            if (context === "auth" && isValidJWT(param)) {
                return true;
            }
            // Additional length check
            if (param.length > 10000) return false;
            return !detectSQLInjection(param);
        }
        // Validate numeric parameters
        if (typeof param === "number") {
            return (
                Number.isFinite(param) &&
                param >= -2147483648 &&
                param <= 2147483647
            );
        }
        // Allow boolean parameters
        if (typeof param === "boolean") {
            return true;
        }
        return param === null || param === undefined; // Allow null/undefined
    });
}

// Validate user input for XSS
function validateUserInput(input) {
    if (typeof input !== "string") return input;

    const xssPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /<iframe[^>]*>.*?<\/iframe>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<\s*\/?\s*(script|iframe|object|embed|form)/gi,
    ];

    return xssPatterns.some((pattern) => pattern.test(input)) ? "" : input;
}

module.exports = {
    detectSQLInjection,
    sanitizeForDB,
    validateQueryParams,
    validateUserInput,
};
