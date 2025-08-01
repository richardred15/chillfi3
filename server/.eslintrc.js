module.exports = {
    env: {
        node: true,
        es2021: true,
        jest: true,
        browser: true
    },
    globals: {
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly'
    },
    extends: [
        'eslint:recommended'
    ],
    parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module'
    },
    rules: {
        'indent': ['error', 4],
        'linebreak-style': 'off',
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
        'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
        'no-console': 'off',
        'no-process-exit': 'off'
    },
    ignorePatterns: [
        'node_modules/',
        'coverage/',
        '*.min.js'
    ]
};