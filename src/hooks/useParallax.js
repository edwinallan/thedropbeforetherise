import { useEffect } from 'react';
import { applyParallax } from '../utils/parallax';

/**
 * Hook to apply parallax to a set of refs. Returns a cleanup fn.
 */
export const useParallax = (refs, strength) => {
  useEffect(() => {
    const cleanup = applyParallax(refs, strength);
    return cleanup;
  }, [refs, strength]);
};
