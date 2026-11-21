import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { UploadsService } from '../src/modules/uploads/uploads.service';

export interface TestUser {
  id: string;
  username: string;
  token: string;
}

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  http: () => ReturnType<typeof request>;
  makeUser: (options?: MakeUserOptions) => Promise<TestUser>;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

export interface MakeUserOptions {
  role?: UserRole;
  isVerified?: boolean;
  emailVerified?: boolean;
  isActive?: boolean;
  username?: string;
  state?: string;
  passwordHash?: string;
}

// Cloudinary is not called in tests. The stub keeps the app from trying to
// reach the internet when an event cover is replaced or deleted.
const uploadsStub = {
  deleteByUrl: jest.fn().mockResolvedValue(undefined),
  deleteDocument: jest.fn().mockResolvedValue(true),
  signedDocumentUrl: jest.fn().mockReturnValue('https://example.com/signed'),
  uploadAvatar: jest.fn(),
  uploadGroupAvatar: jest.fn(),
  uploadPostMedia: jest.fn(),
  uploadListingImage: jest.fn(),
  uploadEventCover: jest.fn(),
  uploadVerificationDocument: jest.fn(),
};

let counter = 0;

export async function createContext(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(UploadsService)
    .useValue(uploadsStub)
    // Many requests from one address would hit the rate limits, so the
    // counter is replaced by one that always says "first request".
    .overrideProvider(ThrottlerStorage)
    .useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 60 }) })
    .compile();

  const app = moduleRef.createNestApplication();

  // The same settings as main.ts.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api/v1');
  await app.init();

  const prisma = app.get(PrismaService);
  const secret = app.get(ConfigService).getOrThrow<string>('jwt.accessSecret');
  const jwt = new JwtService({});

  const reset = async () => {
    // Every table except Prisma's own bookkeeping.
    await prisma.$executeRawUnsafe(`
      DO $$ DECLARE r record;
      BEGIN
        FOR r IN SELECT tablename FROM pg_tables
          WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'
        LOOP
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;`);
  };

  const makeUser = async (options: MakeUserOptions = {}): Promise<TestUser> => {
    counter += 1;
    const username = options.username ?? `user${counter}_${Date.now().toString(36)}`;

    const user = await prisma.user.create({
      data: {
        email: `${username}@example.com`,
        username,
        fullName: `Full ${username}`,
        passwordHash: options.passwordHash ?? 'not-a-real-hash',
        role: options.role ?? UserRole.SERVING_CORPER,
        isVerified: options.isVerified ?? true,
        emailVerified: options.emailVerified ?? true,
        isActive: options.isActive ?? true,
        state: options.state,
      },
    });

    return { id: user.id, username, token: jwt.sign({ sub: user.id }, { secret, expiresIn: '1h' }) };
  };

  return {
    app,
    prisma,
    http: () => request(app.getHttpServer()),
    makeUser,
    reset,
    close: async () => {
      await app.close();
    },
  };
}

export const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` });

export const DAY = 24 * 60 * 60 * 1000;

export const inDays = (days: number) => new Date(Date.now() + days * DAY);

// A link that passes the Cloudinary check for the given folder.
export const cloudinaryUrl = (folder: string) =>
  `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/v1/naijacorper/${folder}/test.jpg`;

export type { PrismaClient };
