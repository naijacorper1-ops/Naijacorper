// Runs before every end-to-end test file. It points the app at the TEST
// database and refuses to continue if that does not look like one, because
// the tests delete all data in it.

const url = process.env.TEST_DATABASE_URL;

if (!url) {
  throw new Error(
    'TEST_DATABASE_URL is not set. The end-to-end tests empty the database they use, so they need ' +
      'their own empty test database. See test/README.md.',
  );
}

let parsed: URL;

try {
  parsed = new URL(url);
} catch {
  throw new Error('TEST_DATABASE_URL is not a valid database address');
}

const databaseName = parsed.pathname.replace(/^\//, '');
const schemaName = parsed.searchParams.get('schema') ?? '';

if (!/test/i.test(databaseName) && !/test/i.test(schemaName)) {
  throw new Error(
    `Refusing to run: the database "${databaseName}" does not have "test" in its name (or in ?schema=). ` +
      'The tests delete all data, so they only run against a database or schema whose name contains "test".',
  );
}

process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;
process.env.NODE_ENV = 'test';
process.env.PORT ??= '4999';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-test-access-secret-0123';
process.env.FRONTEND_URL ??= 'http://localhost:5173';
process.env.COOKIE_DOMAIN ??= 'localhost';
process.env.CLOUDINARY_CLOUD_NAME ??= 'testcloud';
process.env.CLOUDINARY_API_KEY ??= 'test';
process.env.CLOUDINARY_API_SECRET ??= 'test';
process.env.RESEND_API_KEY ??= 're_test';
process.env.RESEND_FROM_ADDRESS ??= 'test@example.com';
