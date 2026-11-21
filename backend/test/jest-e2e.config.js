// End-to-end tests: the real app against a real (test) Postgres database.
//   npm run test:e2e
// Read test/README.md first. These tests EMPTY every table in the database
// they connect to, so they only ever run against TEST_DATABASE_URL.
module.exports = {
  rootDir: '..',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  testTimeout: 30000,
};
