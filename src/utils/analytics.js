/**
 * Fire Google Analytics events if gtag exists; no‑op else.
 */
export const track = (eventName, params = {}) => {
  if (typeof gtag === 'function') {
    gtag('event', eventName, params);
  } else {
    console.debug('[ga]', eventName, params);
  }
};
