-- Run once, after "npx prisma migrate dev", in the Supabase SQL editor.
-- Accounts that were already verified before this update get the new badge.
UPDATE "users" SET "isVerified" = true WHERE "verificationStatus" = 'VERIFIED' AND "isVerified" = false;
