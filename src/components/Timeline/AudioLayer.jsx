import React, { useEffect, useRef } from 'react';
import { toMs } from '../../utils/time';

/**
 * AudioLayer:
 * - Receives `item` (with start/duration/file).
 * - Receives `playhead` (current ms).
 * - Receives `muted` (boolean) from parent.
 *
 * Whenever `playhead >= start`, it calls `ref.current.play()`. 
 * The `<audio>` tag’s `muted={muted}` attribute ensures it honors our toggle.
 */
export default function AudioLayer({ item, playhead, muted = false }) {
  const ref = useRef(null);

  // On each render, check if we need to start playing
  useEffect(() => {
    if (!ref.current) return;
    const start = toMs(item.start);

    if (playhead >= start && ref.current.paused) {
      // Volume is ignored when muted={muted}; React/DOM will handle it
      ref.current.play().catch((err) => {
        console.warn('Audio play failed:', err);
      });
    }
  }, [playhead, item]);

  return (
    <audio
      ref={ref}
      src={item.file}
      preload="auto"
      muted={muted}            // ← this toggles actual sound
      data-start-ms={toMs(item.start)}
    />
  );
}