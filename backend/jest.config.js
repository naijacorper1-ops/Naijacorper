// Unit tests: plain functions and rules, no database needed.
//   npm test
// The end-to-end tests have their own config: npm run test:e2e
module.exports = {
  rootDir: 'src',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
};
