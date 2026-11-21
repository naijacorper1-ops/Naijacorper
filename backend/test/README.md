# End-to-end tests

These start the real app and talk to a real Postgres database. They check the
whole path: validation, guards, permissions, the database, counters and
notifications.

**They delete every row in the database they connect to.** They only ever use
`TEST_DATABASE_URL`, and refuse to run unless that database (or `?schema=`)
has `test` in its name. Never point it at your real database.

## One-time setup

Create an empty Postgres database whose name contains `test`, for example
with Docker:

    docker run -d --name naijacorper-test-db -e POSTGRES_PASSWORD=test -e POSTGRES_DB=naijacorper_test -p 54329:5432 postgres:16

Build its tables with the real migrations (PowerShell):

    $env:DATABASE_URL = "postgresql://postgres:test@localhost:54329/naijacorper_test"
    $env:DIRECT_URL = $env:DATABASE_URL
    npx prisma migrate deploy

## Run

    $env:TEST_DATABASE_URL = "postgresql://postgres:test@localhost:54329/naijacorper_test"
    npm run test:e2e

(On macOS or Linux use `export TEST_DATABASE_URL=...` instead.)

Cloudinary and Resend are never called: uploads are stubbed and test users
are created directly in the database with a signed access token.
