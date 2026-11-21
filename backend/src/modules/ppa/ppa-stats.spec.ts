import { summarisePpa } from './ppa-stats';

const totals = (over: Partial<Parameters<typeof summarisePpa>[0]> = {}) => ({
  reviewCount: 0,
  ratingSum: 0,
  environmentSum: 0,
  learningSum: 0,
  workloadSum: 0,
  staffSum: 0,
  ...over,
});

describe('summarisePpa', () => {
  it('has nothing to average before the first review', () => {
    expect(summarisePpa(totals())).toEqual({
      reviewCount: 0,
      rating: null,
      environment: { average: null, label: null },
      learning: { average: null, label: null },
      workload: { average: null, label: null },
      staffRelationship: { average: null, label: null },
    });
  });

  it('averages to one decimal', () => {
    const result = summarisePpa(totals({ reviewCount: 3, ratingSum: 13 }));
    expect(result.rating).toBe(4.3);
  });

  it('names the four-step scale', () => {
    // POOR=1 FAIR=2 GOOD=3 EXCELLENT=4
    expect(summarisePpa(totals({ reviewCount: 1, environmentSum: 1 })).environment.label).toBe('POOR');
    expect(summarisePpa(totals({ reviewCount: 1, environmentSum: 2 })).environment.label).toBe('FAIR');
    expect(summarisePpa(totals({ reviewCount: 1, environmentSum: 3 })).environment.label).toBe('GOOD');
    expect(summarisePpa(totals({ reviewCount: 1, environmentSum: 4 })).environment.label).toBe('EXCELLENT');
    expect(summarisePpa(totals({ reviewCount: 1, staffSum: 3 })).staffRelationship.label).toBe('GOOD');
  });

  it('names the three-step scale', () => {
    // LOW=1 MODERATE=2 HIGH=3
    expect(summarisePpa(totals({ reviewCount: 1, learningSum: 1 })).learning.label).toBe('LOW');
    expect(summarisePpa(totals({ reviewCount: 1, learningSum: 2 })).learning.label).toBe('MODERATE');
    expect(summarisePpa(totals({ reviewCount: 1, workloadSum: 3 })).workload.label).toBe('HIGH');
  });

  it('rounds the label from the exact average, not the displayed one', () => {
    // 3.45 is shown as 3.5 but is still closer to GOOD (3) than EXCELLENT (4).
    const result = summarisePpa(totals({ reviewCount: 20, environmentSum: 69 }));

    expect(result.environment.average).toBe(3.5);
    expect(result.environment.label).toBe('GOOD');
  });

  it('rounds exactly half up', () => {
    expect(summarisePpa(totals({ reviewCount: 2, environmentSum: 7 })).environment.label).toBe('EXCELLENT');
  });
});
