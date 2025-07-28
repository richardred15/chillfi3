/**
 * Jest Setup for Client Tests
 */

// Polyfills for Node.js environment
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Mock classList
const createMockClassList = (initialClasses = []) => {
    const classes = new Set(initialClasses);
    return {
        contains: jest.fn((className) => classes.has(className)),
        add: jest.fn((className) => classes.add(className)),
        remove: jest.fn((className) => classes.delete(className))
    };
};

// Mock DOM element
const createMockElement = (tagName = 'div', attributes = {}) => ({
    tagName: tagName.toUpperCase(),
    className: attributes.className || '',
    innerHTML: '',
    textContent: '',
    type: attributes.type || '',
    required: attributes.required || false,
    style: {
        setProperty: jest.fn(),
        getPropertyValue: jest.fn(() => ''),
        width: ''
    },
    classList: createMockClassList(attributes.className ? [attributes.className] : []),
    appendChild: jest.fn(),
    querySelector: jest.fn(),
    addEventListener: jest.fn(),
    click: jest.fn(),
    dispatchEvent: jest.fn(),
    remove: jest.fn()
});

// Mock document
global.document = {
    createElement: jest.fn((tagName) => createMockElement(tagName)),
    querySelector: jest.fn(),
    getElementById: jest.fn(),
    body: {
        appendChild: jest.fn(),
        innerHTML: '',
        className: '',
        classList: createMockClassList()
    }
};

// Mock window
global.window = {
    document: global.document,
    localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn()
    },
    Event: jest.fn()
};

global.localStorage = global.window.localStorage;