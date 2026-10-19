// The 36 states plus the FCT. Used so "Lagos", "lagos" and "Lagos State"
// all end up as the same value, which is what makes state feeds and state
// filters work.
export const NIGERIAN_STATES = [
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'FCT',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
] as const;

const BY_LOWERCASE = new Map<string, string>(NIGERIAN_STATES.map((s) => [s.toLowerCase(), s]));

const ALIASES: Record<string, string> = {
  abuja: 'FCT',
  'fct abuja': 'FCT',
  'abuja fct': 'FCT',
  'federal capital territory': 'FCT',
  'f.c.t': 'FCT',
  'f.c.t.': 'FCT',
  akwaibom: 'Akwa Ibom',
  crossriver: 'Cross River',
  'cross-river': 'Cross River',
};

// Returns the canonical state name, or undefined if it isn't a Nigerian state.
export function normalizeState(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s+state$/, '');

  return BY_LOWERCASE.get(cleaned) ?? ALIASES[cleaned];
}
