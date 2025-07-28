/**
 * Input Validation Utilities
 */

const validators = {
    required: (value) => value !== undefined && value !== null && value !== '',
    string: (value) => typeof value === 'string',
    number: (value) => typeof value === 'number' && !isNaN(value),
    email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    minLength: (min) => (value) => value && value.length >= min,
    maxLength: (max) => (value) => value && value.length <= max,
    integer: (value) => Number.isInteger(value),
    positive: (value) => value > 0
};

function validate(data, schema) {
    const errors = {};
    
    for (const [field, rules] of Object.entries(schema)) {
        const value = data[field];
        
        for (const rule of rules) {
            let validator, message;
            
            if (typeof rule === 'string') {
                validator = validators[rule];
                message = `${field} ${rule} validation failed`;
            } else if (typeof rule === 'function') {
                validator = rule;
                message = `${field} validation failed`;
            } else {
                validator = rule.validator;
                message = rule.message || `${field} validation failed`;
            }
            
            if (!validator(value)) {
                errors[field] = message;
                break;
            }
        }
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

module.exports = { validate, validators };