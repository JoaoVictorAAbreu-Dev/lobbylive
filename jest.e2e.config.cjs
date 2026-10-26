const base = require('./jest.config.cjs');
module.exports = { ...base, testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'], testTimeout: 30000 };
