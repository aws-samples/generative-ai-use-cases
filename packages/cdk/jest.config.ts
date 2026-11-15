export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  // Several worktrees often run tests at the same time on one machine. The
  // suite is dominated by one large synth, so more workers barely help.
  // Override with `--maxWorkers` when needed.
  maxWorkers: 2,
  transform: {
    // Transpile only. Type-checking every test file in every worker builds a
    // full TypeScript program (aws-cdk-lib included) per worker, which costs
    // about 2 GB each. Types are still checked by `npm run cdk:build`.
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { isolatedModules: true } }],
    // sanitize-html >= 2.17.6 depends on ESM-only htmlparser2 v12 and its
    // dom* / entities chain; transpile those to CommonJS for Jest.
    '^.+\\.js$': ['ts-jest', { tsconfig: { allowJs: true } }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(sanitize-html/node_modules/)?(htmlparser2|domhandler|domutils|dom-serializer|domelementtype|entities)/)',
  ],
  snapshotSerializers: ['<rootDir>/test/snapshot-plugin.ts'],
  // Escape quotes and backslashes so a snapshot is a template that can be
  // parsed back (JSON apart from trailing commas).
  snapshotFormat: { escapeString: true, printBasicPrototype: false },
  testPathIgnorePatterns: ['/node_modules/', 'e2e.test.ts'],
};
