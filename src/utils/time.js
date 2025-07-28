/**
 * Convert a time string (m:ss.mmm or m:ss:mmm) or number (ms) to milliseconds.
 * @param {string|number} t
 * @returns {number}
 */
export function toMs(timeStr) {
  // Split off any millisecond component
  const [main, msPart] = timeStr.split(".");
  const parts = main.split(":").map(Number);
  let ms = 0;

  if (parts.length === 3) {
    // H:MM:SS
    ms += parts[0] * 3600 * 1000;
    ms += parts[1] * 60 * 1000;
    ms += parts[2] * 1000;
  } else if (parts.length === 2) {
    // M:SS
    ms += parts[0] * 60 * 1000;
    ms += parts[1] * 1000;
  } else if (parts.length === 1) {
    // SS
    ms += parts[0] * 1000;
  }

  if (msPart !== undefined) {
    // Normalize to exactly 3 digits of milliseconds
    const normalized = msPart.padEnd(3, "0").slice(0, 3);
    ms += Number(normalized);
  }

  return ms;
}
