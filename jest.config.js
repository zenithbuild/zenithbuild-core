/** @type {import('jest').Config} */
export default {
    testEnvironment: 'node',
    transform: {},
    testMatch: [
        '**/tests/config.spec.js',
        '**/tests/path.spec.js',
        '**/tests/order.spec.js',
        '**/tests/hash.spec.js',
        '**/tests/errors.spec.js',
        '**/tests/version.spec.js',
        '**/tests/guards.spec.js',
        '**/tests/guardrails.spec.js'
    ]
};
