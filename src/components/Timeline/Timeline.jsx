// src/components/Timeline/Timeline.jsx

import React, { useEffect, useRef, useState } from "react";
import styles from "./Timeline.module.css";
import ProgressBar from "./ProgressBar";
// import BackgroundLayer from "./BackgroundLayer";  <-- REMOVED
import VideoLayer from "./VideoLayer";
import { toMs } from "../../utils/time";
import playlist from "../../playlist.json";
import { track } from "../../utils/analytics";
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
  const [isPlaying, setIsPlaying] = useState(false);
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
  // Show early outro overlay
  const [showEarlyOutro, setShowEarlyOutro] = useState(false);
  // Prevent multiple final outro triggers
  const [finalOutroTriggered, setFinalOutroTriggered] = useState(false);

  // Global buffering gate: if any video stalls, we pause everything and show a loader
  const [bufferingCount, setBufferingCount] = useState(0);
  const isBuffering = bufferingCount > 0;
  const [isScrubbing, setIsScrubbing] = useState(false);
  const wasPlayingOnScrubRef = useRef(false);

  const [replayToken, setReplayToken] = useState(0);

  const handleBufferingChange = React.useCallback((isBuf) => {
    setBufferingCount((prev) => {
      const next = Math.max(0, prev + (isBuf ? 1 : -1));
      return next;
    });
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

  const isSafari = React.useMemo(() => {
    const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
    return /^((?!chrome|android).)*safari/i.test(ua);
  }, []);

  // Compute total duration from real media metadata without querying the DOM each time
  useEffect(() => {
    const recalc = () => {
      let max = 0;
      mediaRegistry.current.forEach(({ el, item, isMaster }) => {
        const startMs = isMaster ? toMs(item.start) : 0;
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
        setIsPlaying(true);
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

  // Periodically resync all media elements to the master playhead
  useEffect(() => {
    if (!isPlaying) return;
    mediaRegistry.current.forEach(({ el, item }) => {
      const startMs = toMs(item.start);
      const endMs = item.duration
        ? startMs + toMs(item.duration)
        : totalDuration;
      if (time >= startMs && time < endMs) {
        const desiredSec = (time - startMs) / 1000;
        if (Math.abs(el.currentTime - desiredSec) > 0.05) {
          try {
            el.currentTime = desiredSec;
          } catch {}
        }
      }
    });
  }, [time, isPlaying, totalDuration]);

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

  // Reset and replay the entire timeline
  const handleTimelineReplay = () => {
    console.log(
      "[Timeline] Replaying timeline: registry size=",
      mediaRegistry.current.length
    );
    // Pause everything first
    mediaRegistry.current.forEach(({ el, item, isMaster }) => {
      try {
        console.log("[Timeline] pausing", {
          start: item.start,
          isMaster,
          currentTime: el.currentTime,
        });
        el.pause();
        console.log("[Timeline] paused", {
          start: item.start,
          isMaster,
          currentTime: el.currentTime,
        });
      } catch (err) {
        console.warn(
          "[Timeline] pause() failed for",
          { start: item.start, isMaster },
          err
        );
      }
    });

    // Seek each element back to its start-relative time (master to 0s; others to 0 to avoid showing last frame)
    mediaRegistry.current.forEach(({ el, item, isMaster }) => {
      const startMs = toMs(item.start);
      const desired = isMaster ? 0 : 0; // keep non-master at 0; they'll stay paused until their window
      try {
        const before = el.currentTime;
        el.currentTime = desired;
        console.log("[Timeline] seek", {
          start: item.start,
          isMaster,
          before,
          after: el.currentTime,
        });
      } catch (err) {
        console.error(
          "[Timeline] error seeking",
          { start: item.start, isMaster },
          err
        );
      }
    });

    // Reset UI state and overlays
    setTime(0);
    setShowPauseOverlay(false);
    setShowOutroOverlay(false);
    setIsPlaying(true);

    // Bump token to let VideoLayers reset their internal flags (e.g., playedRef)
    setReplayToken((n) => n + 1);

    // Start only the master; others will start when their window opens
    const master = masterElRef.current;
    if (master) {
      // Defer play until after the current tick so currentTime writes settle
      setTimeout(() => {
        console.log("[Timeline] playing master", {
          currentTime: master.currentTime,
        });
        master
          .play()
          .then(() => {
            console.log("[Timeline] master playing from", master.currentTime);
            // now notify parent that replay has occurred
            if (typeof onReplay === "function") {
              onReplay();
            }
          })
          .catch((err) =>
            console.error("[Timeline] master play() failed", err)
          );
      }, 0);
    } else {
      console.warn("[Timeline] No master element registered");
    }
  };

  // Handle anywhere‑click on the stage: toggle play/pause
  const handleClick = (e) => {
    if (e.target.closest("button") || e.target.closest("a")) return;

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
  const handleScrubStart = React.useCallback(() => {
    wasPlayingOnScrubRef.current = isPlaying;
    if (isPlaying) {
      mediaRegistry.current.forEach(({ el }) => {
        try {
          el.pause();
        } catch {}
      });
      setIsPlaying(false);
    }
    setShowPauseOverlay(false);
    setIsScrubbing(true);
  }, [isPlaying]);

  const handleScrubEnd = React.useCallback(() => {
    setIsScrubbing(false);
    if (wasPlayingOnScrubRef.current) {
      mediaRegistry.current.forEach(({ el }) => {
        try {
          el.play().catch(() => {});
        } catch {}
      });
      setIsPlaying(true);
    }
  }, []);

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

  const filteredItems = React.useMemo(() => {
    // Exclude background items; filter videos by device
    return playlist.items
      .filter((item) => item.type !== "background")
      .filter((item) => {
        if (item.type !== "video") return true;
        return isMobile
          ? item.showOnMobile === true
          : item.showOnMobile === false;
      });
  }, [isMobile]);

  let firstVideo = true;
  let firstAudio = true;
  const layers = filteredItems.map((item, idx) => {
    switch (item.type) {
      // case "background":
      //   return <BackgroundLayer key={idx} item={item} playhead={time} />;
      case "video": {
        const isMasterVideo = firstVideo;
        if (firstVideo) firstVideo = false;
        return (
          <VideoLayer
            key={idx}
            item={item}
            playhead={time}
            registerMedia={registerMedia}
            getPlayheadMs={getPlayheadMs}
            onBufferingChange={handleBufferingChange}
            isMaster={isMasterVideo}
            forceHlsJs={isSafari}
            replayToken={replayToken}
          />
        );
      }
      default:
        return null;
    }
  });

  useEffect(() => {
    const outroWindow =
      totalDuration > 0 && time >= totalDuration - OUTRO_OFFSET_MS;
    if (outroWindow) {
      // Show final overlay
      if (!showOutroOverlay) {
        setShowOutroOverlay(true);
        if (!finalOutroTriggered) {
          setFinalOutroTriggered(true);
          onComplete(); // notify parent to transition to outro
        }
      }
      // Show early overlay only if before final trigger
      if (!outroEarlyTriggered) {
        setOutroEarlyTriggered(true);
        setShowEarlyOutro(true);
      }
    } else {
      // Reset if scrubbing back
      if (outroEarlyTriggered) {
        setOutroEarlyTriggered(false);
        setShowEarlyOutro(false);
      }
      if (finalOutroTriggered) {
        setFinalOutroTriggered(false);
      }
      if (showOutroOverlay) {
        setShowOutroOverlay(false);
      }
    }
  }, [
    time,
    totalDuration,
    showOutroOverlay,
    outroEarlyTriggered,
    finalOutroTriggered,
    onComplete,
  ]);

  return (
    // Attach `onClick` to the stage itself
    <div className={styles.stage} onClick={handleClick}>
      <div
        className={styles.background}
        style={{
          position: "fixed",
          inset: 0,
          background: currentBgColor,
          zIndex: 0,
          transition: "background 500ms linear",
        }}
      />
      {layers}
      <ProgressBar
        time={time}
        total={totalDuration}
        chapters={playlist.chapters}
        bgColor={currentBgColor}
        onSeek={handleSeek}
        onScrubStart={handleScrubStart}
        onScrubEnd={handleScrubEnd}
      />
      {showEarlyOutro && !showPauseOverlay && !showOutroOverlay && (
        <div className={styles.pauseOverlay}>
          <Outro onReplay={handleTimelineReplay} showReplay={true} />
        </div>
      )}
      {showPauseOverlay && !showOutroOverlay && (
        <div className={styles.pauseOverlay}>
          <Outro onReplay={handleTimelineReplay} showReplay={false} />
        </div>
      )}
      {showOutroOverlay && (
        <div className={styles.outroOverlay}>
          <Outro onReplay={handleTimelineReplay} showReplay={true} />
        </div>
      )}
      {isBuffering && <div className={styles.loadingOverlay}>Loading…</div>}
    </div>
  );
}
