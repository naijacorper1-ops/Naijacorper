-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('JOB', 'INTERNSHIP', 'FREELANCE', 'SCHOLARSHIP', 'GRANT', 'TRAINING', 'COMPETITION', 'BUSINESS', 'NETWORKING', 'OTHER');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('PENDING', 'OPEN', 'CLOSED', 'REJECTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('ONSITE', 'REMOTE', 'HYBRID');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'VOLUNTEER');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('MEETUP', 'NYSC_EVENT', 'NETWORKING', 'TECH', 'BUSINESS', 'SOCIAL', 'TRAINING', 'CAREER');

-- CreateEnum
CREATE TYPE "EventFormat" AS ENUM ('PHYSICAL', 'VIRTUAL', 'HYBRID');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED', 'CANCELLED', 'REMOVED');

-- CreateEnum
CREATE TYPE "PpaSector" AS ENUM ('BANKING_FINANCE', 'TECHNOLOGY', 'EDUCATION', 'HEALTHCARE', 'GOVERNMENT', 'MEDIA', 'MANUFACTURING', 'NGO', 'OTHER');

-- CreateEnum
CREATE TYPE "RatingLevel" AS ENUM ('POOR', 'FAIR', 'GOOD', 'EXCELLENT');

-- CreateEnum
CREATE TYPE "IntensityLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'OPPORTUNITY_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'OPPORTUNITY_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_CANCELLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReportTargetType" ADD VALUE 'OPPORTUNITY';
ALTER TYPE "ReportTargetType" ADD VALUE 'EVENT';
ALTER TYPE "ReportTargetType" ADD VALUE 'PPA_REVIEW';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "opportunityId" TEXT;

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "postedById" TEXT NOT NULL,
    "type" "OpportunityType" NOT NULL,
    "title" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "mode" "WorkMode" NOT NULL DEFAULT 'ONSITE',
    "state" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Nigeria',
    "employmentType" "EmploymentType",
    "compensationMin" INTEGER,
    "compensationMax" INTEGER,
    "compensationNote" TEXT,
    "duration" TEXT,
    "deadline" TIMESTAMP(3),
    "applyUrl" TEXT,
    "applyEmail" TEXT,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "removedReason" TEXT,
    "removedAt" TIMESTAMP(3),
    "removedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "EventCategory" NOT NULL,
    "coverImageUrl" TEXT,
    "organizerName" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "format" "EventFormat" NOT NULL DEFAULT 'PHYSICAL',
    "state" TEXT,
    "lga" TEXT,
    "city" TEXT,
    "venue" TEXT,
    "registrationUrl" TEXT,
    "meetingUrl" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "removedReason" TEXT,
    "removedAt" TIMESTAMP(3),
    "removedBy" TEXT,
    "rsvpCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_rsvps" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ppas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lga" TEXT,
    "sector" "PpaSector",
    "createdById" TEXT,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "environmentSum" INTEGER NOT NULL DEFAULT 0,
    "learningSum" INTEGER NOT NULL DEFAULT 0,
    "workloadSum" INTEGER NOT NULL DEFAULT 0,
    "staffSum" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ppas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ppa_reviews" (
    "id" TEXT NOT NULL,
    "ppaId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "environment" "RatingLevel" NOT NULL,
    "learning" "IntensityLevel" NOT NULL,
    "workload" "IntensityLevel" NOT NULL,
    "staffRelationship" "RatingLevel" NOT NULL,
    "content" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ppa_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "opportunities_status_createdAt_id_idx" ON "opportunities"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "opportunities_status_type_createdAt_idx" ON "opportunities"("status", "type", "createdAt");

-- CreateIndex
CREATE INDEX "opportunities_status_state_createdAt_idx" ON "opportunities"("status", "state", "createdAt");

-- CreateIndex
CREATE INDEX "opportunities_postedById_createdAt_idx" ON "opportunities"("postedById", "createdAt");

-- CreateIndex
CREATE INDEX "events_status_startsAt_id_idx" ON "events"("status", "startsAt", "id");

-- CreateIndex
CREATE INDEX "events_status_category_startsAt_idx" ON "events"("status", "category", "startsAt");

-- CreateIndex
CREATE INDEX "events_status_state_startsAt_idx" ON "events"("status", "state", "startsAt");

-- CreateIndex
CREATE INDEX "events_status_createdAt_idx" ON "events"("status", "createdAt");

-- CreateIndex
CREATE INDEX "events_createdById_createdAt_idx" ON "events"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "event_rsvps_eventId_createdAt_id_idx" ON "event_rsvps"("eventId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "event_rsvps_userId_createdAt_idx" ON "event_rsvps"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "event_rsvps_eventId_userId_key" ON "event_rsvps"("eventId", "userId");

-- CreateIndex
CREATE INDEX "ppas_lastReviewedAt_id_idx" ON "ppas"("lastReviewedAt", "id");

-- CreateIndex
CREATE INDEX "ppas_state_lastReviewedAt_idx" ON "ppas"("state", "lastReviewedAt");

-- CreateIndex
CREATE INDEX "ppas_sector_idx" ON "ppas"("sector");

-- CreateIndex
CREATE UNIQUE INDEX "ppas_nameKey_state_key" ON "ppas"("nameKey", "state");

-- CreateIndex
CREATE INDEX "ppa_reviews_ppaId_createdAt_id_idx" ON "ppa_reviews"("ppaId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ppa_reviews_authorId_createdAt_idx" ON "ppa_reviews"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "ppa_reviews_createdAt_id_idx" ON "ppa_reviews"("createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ppa_reviews_ppaId_authorId_key" ON "ppa_reviews"("ppaId", "authorId");

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppas" ADD CONSTRAINT "ppas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppa_reviews" ADD CONSTRAINT "ppa_reviews_ppaId_fkey" FOREIGN KEY ("ppaId") REFERENCES "ppas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppa_reviews" ADD CONSTRAINT "ppa_reviews_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

