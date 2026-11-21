// Two people reviewing "Paystack" and "PAYSTACK Ltd." should land on the same
// PPA, not create two. The key is the name with case, accents, punctuation,
// spaces, a leading "the" and company endings (Ltd, Limited, Plc, Inc, LLC,
// Nig) removed, so both of those become "paystack".
//
// The key is only for matching. The name that was typed first is the one that
// is displayed.
const NOISE_WORDS = new Set(['ltd', 'limited', 'plc', 'inc', 'llc', 'nig']);

export function makePpaNameKey(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ');

  const tokens = base.split(/[^a-z0-9]+/).filter(Boolean);

  const meaningful = tokens.filter(
    (token, index) => !NOISE_WORDS.has(token) && !(index === 0 && token === 'the' && tokens.length > 1),
  );

  // A name made only of such words (for example "Ltd") keeps them rather than
  // ending up empty.
  return (meaningful.length > 0 ? meaningful : tokens).join('');
}

// Collapses repeated spaces: "  Zenith   Bank " becomes "Zenith Bank".
export function cleanPpaName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}
