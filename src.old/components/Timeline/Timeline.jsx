// src/components/Timeline/Timeline.jsx

import React, { useEffect, useRef, useState } from "react";
import styles from "./Timeline.module.css";
import ProgressBar from "./ProgressBar";
import BackgroundLayer from "./BackgroundLayer";
import VideoLayer from "./VideoLayer";
import AudioLayer from "./AudioLayer";
import { toMs } from "../../utils/time";
import playlist from "../../playlist.json";
import { track } from "../../utils/analytics";
import { getContrastColor } from "../../utils/colorUtils";
import Outro from "../Outro/Outro";

/**
 * Main Timeline player component.
 * - Tracks a “muted” boolean in state.
 * - OnClick anywhere in the stage (except inside any <button>), toggles “muted”.
 * - Passes muted={muted} down to every <AudioLayer>.
 */
export default function Timeline({
  onComplete,
  onReplay,
  onOutroEarly = () => {},
}) {
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showOutroOverlay, setShowOutroOverlay] = useState(false);
  // Show overlay when timeline is paused
  const [showPauseOverlay, setShowPauseOverlay] = useState(false);
  // Total duration of the whole timeline (ms).
  // Will be determined from the actual media durations once their metadata loads.
  const [totalDuration, setTotalDuration] = useState(0);
  // Reveal the outro overlay this many milliseconds before the timeline ends
  const OUTRO_OFFSET_MS = 2000;
  // Prevent multiple early‑outro callbacks
  const [outroEarlyTriggered, setOutroEarlyTriggered] = useState(false);

  // Global buffering gate: if any video stalls, we pause everything and show a loader
  const [bufferingCount, setBufferingCount] = useState(0);
  const isBuffering = bufferingCount > 0;

  const handleBufferingChange = React.useCallback((isBuf) => {
    setBufferingCount((prev) => Math.max(0, prev + (isBuf ? 1 : -1)));
  }, []);

  const mediaRegistry = useRef([]); // { el, item, isMaster }
  const masterElRef = useRef(null);

  const registerMedia = React.useCallback(
    (el, item, { isMaster = false } = {}) => {
      if (!mediaRegistry.current.some((entry) => entry.el === el)) {
        mediaRegistry.current.push({ el, item, isMaster });
      }
      if (isMaster) masterElRef.current = el;
    },
    []
  );

  const getPlayheadMs = React.useCallback(() => {
    return masterElRef.current ? masterElRef.current.currentTime * 1000 : time;
  }, [time]);

  const [isReady, setIsReady] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 600 : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Compute total duration from real media metadata without querying the DOM each time
  useEffect(() => {
    const recalc = () => {
      let max = 0;
      mediaRegistry.current.forEach(({ el, item }) => {
        const startMs = toMs(item.start);
        const durMs =
          isNaN(el.duration) || !isFinite(el.duration) ? 0 : el.duration * 1000;
        max = Math.max(max, startMs + durMs);
      });
      if (max > 0) setTotalDuration(max);
    };

    mediaRegistry.current.forEach(({ el }) => {
      el.addEventListener("loadedmetadata", recalc);
      el.addEventListener("durationchange", recalc);
    });
    recalc();

    return () => {
      mediaRegistry.current.forEach(({ el }) => {
        el.removeEventListener("loadedmetadata", recalc);
        el.removeEventListener("durationchange", recalc);
      });
    };
  }, []);

  // Wait until all media are ready, then start master and sync others
  useEffect(() => {
    if (isReady || mediaRegistry.current.length === 0) return;

    const waitForReady = (el) =>
      new Promise((resolve) => {
        if (el.readyState >= 2) return resolve();
        el.addEventListener("canplay", resolve, { once: true });
      });

    Promise.all(mediaRegistry.current.map(({ el }) => waitForReady(el))).then(
      () => {
        // Seek everyone to 0 relative to their own start
        mediaRegistry.current.forEach(({ el, item }) => {
          const startMs = toMs(item.start);
          const seekSec = (0 - startMs) / 1000;
          if (seekSec >= 0 && !isNaN(seekSec)) {
            try {
              el.currentTime = seekSec;
            } catch {}
          }
        });

        // Start only the master immediately; others will start when their startMs is reached
        mediaRegistry.current.forEach(({ el, isMaster }) => {
          if (isMaster) {
            el.play().catch(() => {});
          }
        });

        setIsReady(true);
      }
    );
  }, [isReady]);

  // Drive UI time from the master element's clock
  useEffect(() => {
    if (!isPlaying) return;
    let rafId;
    const loop = () => {
      setTime(getPlayheadMs());
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, getPlayheadMs]);

  // Auto-pause everything while any video is buffering, resume when it clears
  useEffect(() => {
    if (!masterElRef.current) return;
    if (isBuffering) {
      mediaRegistry.current.forEach(({ el }) => {
        try {
          el.pause();
        } catch {}
      });
    } else if (isPlaying) {
      mediaRegistry.current.forEach(({ el }) => {
        el.play().catch(() => {});
      });
    }
  }, [isBuffering, isPlaying]);

  // Handle anywhere‑click on the stage: toggle play/pause
  const handleClick = (e) => {
    if (e.target.closest("button")) return;

    if (isPlaying) {
      // Pause playback and show overlay
      setShowPauseOverlay(true);
      track("pause_playback");
      mediaRegistry.current.forEach(({ el }) => {
        try {
          el.pause();
        } catch {}
      });
    } else {
      // Resume playback
      setShowPauseOverlay(false);
      track("resume_playback");
      mediaRegistry.current.forEach(({ el }) => {
        el.play().catch(() => {});
      });
    }

    setIsPlaying(!isPlaying);
  };

  // Seek to a specific moment (ms) – used by ProgressBar scrubbing
  const handleSeek = (ms) => {
    // Hide pause overlay when scrubbing
    setShowPauseOverlay(false);
    // Reset any stale buffering flags picked up while scrubbing
    setBufferingCount(0);
    const clamped = Math.max(0, Math.min(ms, totalDuration));
    setTime(clamped);
    track("seek", { percent: (clamped / totalDuration) * 100 });

    // Re‑sync media
    mediaRegistry.current.forEach(({ el, item }) => {
      el.pause();
      const startMs =
        parseFloat(el.getAttribute("data-start-ms")) || toMs(item.start);
      const seekSec = (clamped - startMs) / 1000;
      if (!isNaN(seekSec) && seekSec >= 0 && seekSec <= el.duration) {
        try {
          el.currentTime = seekSec;
        } catch {}
      }
    });

    // If the user has scrubbed into the outro window, reveal it immediately;
    // otherwise hide it until the playhead re‑enters the window.
    if (totalDuration > 0 && clamped >= totalDuration - OUTRO_OFFSET_MS) {
      setShowOutroOverlay(true);
    } else if (showOutroOverlay) {
      setShowOutroOverlay(false);
    }

    // Auto‑resume timeline if it was paused
    if (!isPlaying) {
      setIsPlaying(true);
    }

    // Ensure all media resume playing after the seek
    setTimeout(() => {
      mediaRegistry.current.forEach(({ el }) => {
        el.play().catch(() => {});
      });
    }, 0);
  };

  // Determine current background color from playlist items
  const currentBgColor = React.useMemo(() => {
    // Filter for background items whose start time is <= current time
    const bgItems = playlist.items
      .filter((item) => item.type === "background")
      .map((item) => ({
        color: item.color,
        startMs: toMs(item.start),
      }))
      .filter((entry) => time >= entry.startMs);
    // If no background is active yet, default to black
    if (bgItems.length === 0) return "#000000";
    // Pick the most recent background
    const latest = bgItems.reduce((prev, curr) =>
      curr.startMs > prev.startMs ? curr : prev
    );
    return latest.color;
  }, [time]);

  // Compute contrast color for the progress bar
  const contrastBarColor = React.useMemo(
    () => getContrastColor(currentBgColor),
    [currentBgColor]
  );

  const filteredItems = React.useMemo(() => {
    return playlist.items.filter((item) => {
      if (item.type !== "video") return true; // keep backgrounds/webm videos as they already specify showOnMobile
      // Only keep the HLS variant that matches the device
      return isMobile
        ? item.showOnMobile === true
        : item.showOnMobile === false;
    });
  }, [isMobile]);

  let firstAudio = true;
  const layers = filteredItems.map((item, idx) => {
    switch (item.type) {
      case "background":
        return <BackgroundLayer key={idx} item={item} playhead={time} />;
      case "video":
        return (
          <VideoLayer
            key={idx}
            item={item}
            playhead={time}
            registerMedia={registerMedia}
            getPlayheadMs={getPlayheadMs}
            onBufferingChange={handleBufferingChange}
          />
        );
      case "audio": {
        const isMaster = firstAudio;
        if (firstAudio) firstAudio = false;
        return (
          <AudioLayer
            key={idx}
            item={item}
            playhead={time}
            muted={false}
            isMaster={isMaster}
            registerMedia={registerMedia}
            qualityUrls={{
              low: item.low,
              medium: item.medium,
              high: item.high,
            }}
          />
        );
      }
      default:
        return null;
    }
  });

  useEffect(() => {
    if (totalDuration > 0 && time >= totalDuration - OUTRO_OFFSET_MS) {
      if (!showOutroOverlay) {
        setShowOutroOverlay(true);
      }
      if (!outroEarlyTriggered) {
        setOutroEarlyTriggered(true);
        onOutroEarly(); // inform parent (App) that we're in the outro window
      }
    } else if (outroEarlyTriggered && time < totalDuration - OUTRO_OFFSET_MS) {
      // If the user scrubbed back before the window, reset so it can fire again
      setOutroEarlyTriggered(false);
    }
  }, [
    time,
    totalDuration,
    showOutroOverlay,
    outroEarlyTriggered,
    onOutroEarly,
  ]);

  return (
    // Attach `onClick` to the stage itself
    <div className={styles.stage} onClick={handleClick}>
      {layers}
      <ProgressBar
        time={time}
        total={totalDuration}
        chapters={playlist.chapters}
        barColor={contrastBarColor}
        onSeek={handleSeek}
      />
      {showPauseOverlay && !showOutroOverlay && (
        <div className={styles.pauseOverlay}>
          <Outro onReplay={onReplay} showReplay={false} />
        </div>
      )}
      {showOutroOverlay && (
        <div className={styles.outroOverlay}>
          <Outro onReplay={onReplay} />
        </div>
      )}
      {isBuffering && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            fontSize: "18px",
            zIndex: 9999,
          }}
        >
          Loading…
        </div>
      )}
    </div>
  );
}
