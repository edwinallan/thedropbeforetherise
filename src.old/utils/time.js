/**
 * Convert a time string (m:ss.mmm or m:ss:mmm) or number (ms) to milliseconds.
 * @param {string|number} t
 * @returns {number}
 */
export const toMs = (t) => {
  if (typeof t === 'number') return t;
  const match = t.match(/(\d+):(\d{2})[:.](\d{3})/);
  if (!match) throw new Error('Invalid time string: ' + t);
  const [, m, s, ms] = match.map(Number);
  return (m * 60 + s) * 1000 + ms;
};
