// Creates the first admin account, or makes an existing account an admin.
//
// Run from the backend folder:
//   npx ts-node src/scripts/create-admin.ts you@example.com yourusername "Your Full Name"
//
// The password is typed at a prompt (hidden), so it never appears in your
// command history or in a file. Run it with the same .env that the backend
// uses, so it reaches the same database. For the live database, put the
// live DATABASE_URL in the environment for that one command.
import { PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import 'dotenv/config';
import * as readline from 'readline';
import { RESERVED_USERNAMES, USERNAME_PATTERN } from '../common/validators/username.validator';

const PASSWORD_PATTERN = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

// Reads typed lines one at a time without showing what is typed.
// One reader is used for both prompts, so a fast paste or piped input
// cannot lose the second line.
function createHiddenReader() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const write = rl as unknown as { _writeToOutput: (text: string) => void };
  const waiting: Array<(line: string) => void> = [];
  const received: string[] = [];
  let closed = false;

  write._writeToOutput = () => undefined;

  rl.on('line', (line) => {
    const next = waiting.shift();

    if (next) {
      next(line);
    } else {
      received.push(line);
    }
  });

  rl.on('close', () => {
    closed = true;
    // Input ended early: treat what is still waited on as empty answers.
    while (waiting.length > 0) {
      waiting.shift()?.('');
    }
  });

  return {
    ask(question: string): Promise<string> {
      process.stdout.write(question);

      return new Promise((resolve) => {
        const ready = received.shift();

        if (ready !== undefined || closed) {
          process.stdout.write('\n');
          resolve(ready ?? '');
          return;
        }

        waiting.push((line) => {
          process.stdout.write('\n');
          resolve(line);
        });
      });
    },
    close() {
      rl.close();
    },
  };
}

async function main() {
  const [emailArg, usernameArg, ...nameParts] = process.argv.slice(2);

  if (!emailArg || !usernameArg) {
    console.error(
      'Usage: npx ts-node src/scripts/create-admin.ts <email> <username> ["Full Name"]',
    );
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const username = usernameArg.trim().toLowerCase();
  const fullName = nameParts.join(' ').trim() || 'NaijaCorper Admin';

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    console.error('That does not look like an email address.');
    process.exit(1);
  }

  if (!USERNAME_PATTERN.test(username)) {
    console.error('Username must be 3 to 20 characters: lowercase letters, numbers and underscores.');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (existing) {
      // An account with this email already exists: promote it.
      if (existing.role === UserRole.ADMIN) {
        console.log(`${existing.email} is already an admin. Nothing to do.`);
        return;
      }

      await prisma.user.update({
        where: { id: existing.id },
        data: { role: UserRole.ADMIN, isActive: true, emailVerified: true },
      });

      console.log(`${existing.email} is now an admin. Their password was not changed.`);
      return;
    }

    if (RESERVED_USERNAMES.has(username) && username !== 'admin') {
      console.error('That username is reserved. Pick another one.');
      process.exit(1);
    }

    const taken = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
    });

    if (taken) {
      console.error('That username is already used by another account.');
      process.exit(1);
    }

    const reader = createHiddenReader();
    const password = await reader.ask('Choose a password (hidden): ');
    const again = await reader.ask('Type it again: ');
    reader.close();

    if (password !== again) {
      console.error('The two passwords do not match.');
      process.exit(1);
    }

    if (password.length < 12 || password.length > 128 || !PASSWORD_PATTERN.test(password)) {
      console.error(
        'Admin passwords need at least 12 characters with an uppercase letter, a lowercase letter and a number.',
      );
      process.exit(1);
    }

    await prisma.user.create({
      data: {
        email,
        username,
        fullName,
        passwordHash: await argon2.hash(password),
        role: UserRole.ADMIN,
        emailVerified: true,
        onboardingCompleted: true,
      },
    });

    console.log(`Admin created: ${email} (username: ${username}). You can log in now.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Could not create the admin:', error instanceof Error ? error.message : error);
  process.exit(1);
});
