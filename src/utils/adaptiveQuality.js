/**
 * Decide whether to immediately fetch high‑res assets.
 * Follows spec: fast connections → fetch immediately, else wait.
 */
export const isFastConnection = () => {
  const c = navigator.connection;
  return c?.effectiveType?.includes('4g') || (c && c.downlink >= 2);
};
