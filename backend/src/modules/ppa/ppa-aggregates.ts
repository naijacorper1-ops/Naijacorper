import { Prisma } from '@prisma/client';

// A PPA keeps running totals of its reviews, so the list and the averages do
// not have to read every review. The totals are always rebuilt from the review
// rows themselves (never nudged up or down), so they cannot drift.
//
// Use both functions inside the same transaction as the review change:
//   1. lockPpas      - one change to a PPA's reviews at a time
//   2. change the review rows
//   3. recomputePpaAggregates
//
// POOR=1 FAIR=2 GOOD=3 EXCELLENT=4, LOW=1 MODERATE=2 HIGH=3 (see schema.prisma).

export async function lockPpas(tx: Prisma.TransactionClient, ppaIds: string[]) {
  if (ppaIds.length === 0) {
    return;
  }

  // Sorted, so two transactions locking several PPAs cannot wait on each other.
  await tx.$queryRaw`
    SELECT "id" FROM "ppas" WHERE "id" = ANY(${ppaIds}::text[]) ORDER BY "id" FOR UPDATE`;
}

export async function recomputePpaAggregates(tx: Prisma.TransactionClient, ppaIds: string[]) {
  if (ppaIds.length === 0) {
    return;
  }

  await tx.$executeRaw`
    UPDATE "ppas" p SET
      "reviewCount" = s."reviewCount",
      "ratingSum" = s."ratingSum",
      "environmentSum" = s."environmentSum",
      "learningSum" = s."learningSum",
      "workloadSum" = s."workloadSum",
      "staffSum" = s."staffSum",
      "lastReviewedAt" = s."lastReviewedAt"
    FROM (
      SELECT
        p2."id" AS "id",
        count(r."id")::int AS "reviewCount",
        COALESCE(sum(r."overallRating"), 0)::int AS "ratingSum",
        COALESCE(sum(CASE r."environment"
          WHEN 'POOR' THEN 1 WHEN 'FAIR' THEN 2 WHEN 'GOOD' THEN 3 WHEN 'EXCELLENT' THEN 4 END), 0)::int AS "environmentSum",
        COALESCE(sum(CASE r."learning"
          WHEN 'LOW' THEN 1 WHEN 'MODERATE' THEN 2 WHEN 'HIGH' THEN 3 END), 0)::int AS "learningSum",
        COALESCE(sum(CASE r."workload"
          WHEN 'LOW' THEN 1 WHEN 'MODERATE' THEN 2 WHEN 'HIGH' THEN 3 END), 0)::int AS "workloadSum",
        COALESCE(sum(CASE r."staffRelationship"
          WHEN 'POOR' THEN 1 WHEN 'FAIR' THEN 2 WHEN 'GOOD' THEN 3 WHEN 'EXCELLENT' THEN 4 END), 0)::int AS "staffSum",
        max(r."createdAt") AS "lastReviewedAt"
      FROM "ppas" p2
      LEFT JOIN "ppa_reviews" r ON r."ppaId" = p2."id"
      WHERE p2."id" = ANY(${ppaIds}::text[])
      GROUP BY p2."id"
    ) s
    WHERE p."id" = s."id"`;
}
