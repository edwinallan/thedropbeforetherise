import React, { useEffect, useRef } from "react";
import { toMs } from "../../utils/time";

/**
 * AudioLayer:
 * - Receives `item` (with start/duration/file).
 * - Receives `playhead` (current ms).
 * - Receives `muted` (boolean) from parent.
 *
 * Whenever `playhead >= start`, it calls `ref.current.play()`.
 * The `<audio>` tag’s `muted={muted}` attribute ensures it honors our toggle.
 */
export default function AudioLayer({
  item,
  playhead,
  muted = false,
  isMaster = false,
  registerMedia,
  qualityUrls = null,
}) {
  const ref = useRef(null);

  const src = React.useMemo(() => {
    if (!qualityUrls) return item.file;
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;
    const type = connection?.effectiveType;
    if (type === "slow-2g" || type === "2g") {
      return qualityUrls.low;
    } else if (type === "3g") {
      return qualityUrls.medium || qualityUrls.low;
    }
    return qualityUrls.high || item.file;
  }, [qualityUrls, item.file]);

  // Ensure we request from the correct root if path is relative
  const finalSrc =
    src.startsWith("http") || src.startsWith("/") ? src : `/${src}`;

  // Register this media element with the parent Timeline
  useEffect(() => {
    if (!ref.current || !registerMedia) return;
    registerMedia(ref.current, item, { isMaster });
  }, [registerMedia, item, isMaster]);

  // Control playback timing based on the timeline playhead
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const startMs = toMs(item.start);
    if (playhead >= startMs) {
      el.play().catch(() => {});
    } else {
      el.pause();
      // Reset to start when rewinding before this segment
      el.currentTime = 0;
    }
  }, [playhead, item.start]);

  return (
    <audio
      ref={ref}
      src={finalSrc}
      preload="auto"
      muted={muted} // ← this toggles actual sound
      data-is-master={isMaster ? "1" : "0"}
      data-start-ms={toMs(item.start)}
    />
  );
}
