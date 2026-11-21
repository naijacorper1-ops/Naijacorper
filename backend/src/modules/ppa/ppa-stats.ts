// Turns a PPA's stored totals into the numbers the app shows.

const RATING_LABELS = ['POOR', 'FAIR', 'GOOD', 'EXCELLENT'] as const;
const INTENSITY_LABELS = ['LOW', 'MODERATE', 'HIGH'] as const;

export type RatingLabel = (typeof RATING_LABELS)[number];
export type IntensityLabel = (typeof INTENSITY_LABELS)[number];

export interface PpaTotals {
  reviewCount: number;
  ratingSum: number;
  environmentSum: number;
  learningSum: number;
  workloadSum: number;
  staffSum: number;
}

const oneDecimal = (value: number) => Math.round(value * 10) / 10;

// The word for an average: 3.4 on the four-step scale is GOOD, 3.5 is
// EXCELLENT. It uses the exact average, not the rounded one shown next to it.
function scale<T extends readonly string[]>(labels: T, sum: number, count: number) {
  if (count === 0) {
    return { average: null, label: null };
  }

  const exact = sum / count;
  const index = Math.min(labels.length, Math.max(1, Math.round(exact)));

  return { average: oneDecimal(exact), label: labels[index - 1] as T[number] };
}

export function summarisePpa(totals: PpaTotals) {
  const count = totals.reviewCount;

  return {
    reviewCount: count,
    // 1 to 5, one decimal. Null until the first review.
    rating: count > 0 ? oneDecimal(totals.ratingSum / count) : null,
    environment: scale(RATING_LABELS, totals.environmentSum, count),
    learning: scale(INTENSITY_LABELS, totals.learningSum, count),
    workload: scale(INTENSITY_LABELS, totals.workloadSum, count),
    staffRelationship: scale(RATING_LABELS, totals.staffSum, count),
  };
}
