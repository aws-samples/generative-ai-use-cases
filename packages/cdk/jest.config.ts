export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    // sanitize-html >= 2.17.6 depends on ESM-only htmlparser2 v12 and its
    // dom* / entities chain; transpile those to CommonJS for Jest.
    '^.+\\.js$': ['ts-jest', { tsconfig: { allowJs: true } }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(sanitize-html/node_modules/)?(htmlparser2|domhandler|domutils|dom-serializer|domelementtype|entities)/)',
  ],
  snapshotSerializers: ['<rootDir>/test/snapshot-plugin.ts'],
  testPathIgnorePatterns: ['/node_modules/', 'e2e.test.ts'],
};
