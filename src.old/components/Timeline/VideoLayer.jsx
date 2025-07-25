// src/components/Timeline/VideoLayer.jsx
import React, { useEffect, useRef, useState } from "react";
import { toMs } from "../../utils/time";
import styles from "./VideoLayer.module.css";
import Hls from "hls.js";
import { pickFinalUrl } from "../../utils/hlsLoader";

export default function VideoLayer({
  item,
  playhead,
  registerMedia,
  getPlayheadMs,
  onBufferingChange,
}) {
  const ref = useRef(null);
  const playedRef = useRef(false);
  const hlsRef = useRef(null);
  const hlsEndedHandlerRef = useRef(null);
  // Keep the latest playhead value in a ref for syncing
  const playheadRef = useRef(playhead);

  // Register with Timeline so it can manage readiness and seeks
  useEffect(() => {
    if (!ref.current || !registerMedia) return;
    registerMedia(ref.current, item, { isMaster: false });
  }, [registerMedia, item]);

  // Track window width for showOnMobile
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1000
  );
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);

  // Initialize video source (HLS or standard)
  useEffect(() => {
    let cancelled = false;
    const videoElem = ref.current;
    if (!videoElem) return;

    (async () => {
      const url = await pickFinalUrl(item, windowWidth < 600);

      if (cancelled) return;

      const isHls = /\.m3u8$/i.test(url);
      if (isHls) {
        if (videoElem.canPlayType("application/vnd.apple.mpegurl")) {
          // Use native HLS playback on Safari
          videoElem.src = url;
        } else if (Hls.isSupported()) {
          // Use Hls.js for other browsers
          const hls = new Hls({
            autoStartLoad: true, // manual loading control
            startLevel: -1, // let ABR choose initial level
            capLevelToPlayerSize: true,
            maxBufferLength: 5,
            maxMaxBufferLength: 60,
            backBufferLength: 100,
            abrEwmaFastVoD: 1.0,
            abrEwmaSlowVoD: 3.0,
            abrMaxWithRealBitrate: true,
          });
          hlsRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(videoElem);

          // Pre-warm a small buffer (5s) then pause loading until actual play
          await new Promise((resolve) => {
            let buffered = 0;
            const onFragBuffered = (_e, data) => {
              buffered += data?.frag?.duration || 0;
              if (buffered >= 5) {
                hls.off(Hls.Events.FRAG_BUFFERED, onFragBuffered);
                hls.stopLoad();
                resolve();
              }
            };
            hls.once(Hls.Events.MANIFEST_PARSED, () => {
              hls.startLoad(0);
            });
            hls.on(Hls.Events.FRAG_BUFFERED, onFragBuffered);
          });
          if (cancelled) return;

          const handleHlsEnded = () => {
            if (hlsRef.current) hlsRef.current.stopLoad();
          };
          hlsEndedHandlerRef.current = handleHlsEnded;
          videoElem.addEventListener("ended", handleHlsEnded);
        } else {
          console.error(`[VideoLayer] HLS not supported for ${url}`);
        }
      } else {
        videoElem.src = url;
      }
    })();

    return () => {
      cancelled = true;
      if (hlsEndedHandlerRef.current && videoElem) {
        videoElem.removeEventListener("ended", hlsEndedHandlerRef.current);
        hlsEndedHandlerRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [
    item.file,
    item.fileMobile,
    item.fileDesktop,
    item.fileH264,
    item.fileHevc,
    windowWidth,
  ]);

  // Report buffering / playing to Timeline so it can pause the master clock
  useEffect(() => {
    const video = ref.current;
    if (!video || !onBufferingChange) return;

    const startMs = toMs(item.start);
    const endMs = item.duration ? startMs + toMs(item.duration) : Infinity;

    const bufferingRef = { current: false };

    const isActive = () => {
      const ph = playheadRef.current;
      return ph >= startMs && ph < endMs;
    };

    const setBuf = (val) => {
      if (!isActive()) {
        // If we're outside our active window, make sure we never keep the global loader stuck on
        if (bufferingRef.current) {
          bufferingRef.current = false;
          onBufferingChange(false);
        }
        return;
      }
      if (bufferingRef.current === val) return;
      bufferingRef.current = val;
      onBufferingChange(val);
    };

    const onWaiting = () => setBuf(true);
    const onStalled = () => setBuf(true);
    const onSeeking = () => setBuf(true);
    const onPlaying = () => setBuf(false);
    const onCanPlay = () => setBuf(false);
    const onEnded = () => setBuf(false);

    const onLoadedMetadata = () => setBuf(false);
    const onLoadedData = () => setBuf(false);
    const onTimeUpdate = () => {
      // Safari sometimes never fires canplay/playing for native HLS; if we see frames/time advancing, clear the loader
      if (
        video.readyState >= 2 &&
        (video.videoWidth > 0 || video.currentTime > 0)
      ) {
        setBuf(false);
      }
    };

    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onStalled);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("ended", onEnded);

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("ended", onEnded);

      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("timeupdate", onTimeUpdate);

      // Ensure we don't leak a stuck true on unmount
      if (bufferingRef.current) onBufferingChange(false);
    };
  }, [onBufferingChange, item.start, item.duration]);

  // Debug: log basic play‑state and errors for this video element
  /*useEffect(() => {
    const videoElem = ref.current;
    if (!videoElem) return;

    const handlePlay = () => console.log(`[VideoLayer] ${item.file} :: play`);
    const handlePause = () => console.log(`[VideoLayer] ${item.file} :: pause`);
    const handleError = (e) =>
      console.error(`[VideoLayer] ${item.file} :: error`, e);

    videoElem.addEventListener('play', handlePlay);
    videoElem.addEventListener('pause', handlePause);
    videoElem.addEventListener('error', handleError);

    // Clean up listeners on unmount or when the item changes
    return () => {
      videoElem.removeEventListener('play', handlePlay);
      videoElem.removeEventListener('pause', handlePause);
      videoElem.removeEventListener('error', handleError);
    };
  }, [item.file]);*/

  // Playback control according to playhead
  useEffect(() => {
    const startMs = toMs(item.start);
    const endMs = item.duration ? startMs + toMs(item.duration) : Infinity;
    if (ref.current) {
      const videoElem = ref.current;

      const startPlayback = () => {
        // Align precisely with the latest global playhead
        videoElem.currentTime = (playheadRef.current - startMs) / 1000;
        // Start loading HLS fragments now that we're actually playing
        if (hlsRef.current && typeof hlsRef.current.startLoad === "function") {
          hlsRef.current.startLoad(videoElem.currentTime);
        }
        videoElem.play().catch(() => {});
        if (onBufferingChange) onBufferingChange(false);
        playedRef.current = true;

        videoElem.removeEventListener("canplay", startPlayback);
      };

      if (playhead >= startMs && !playedRef.current) {
        startPlayback();
      }

      if (playhead >= endMs && !videoElem.paused) {
        videoElem.pause();
      }
    }
  }, [playhead, item]);

  // Micro drift correction using rVFC (fallback to rAF) and tiny playbackRate tweaks
  useEffect(() => {
    const videoElem = ref.current;
    if (!videoElem || !getPlayheadMs) return;
    const startMs = toMs(item.start);
    const TOL = 0.03; // 30ms
    let cancelled = false;

    if (videoElem.requestVideoFrameCallback) {
      const step = (_now, meta) => {
        if (cancelled) return;
        const expected = (getPlayheadMs() - startMs) / 1000;
        const mediaTime = meta?.mediaTime ?? videoElem.currentTime;
        const drift = mediaTime - expected;
        if (Math.abs(drift) > TOL) {
          const desiredRate = 1 - drift * 0.5;
          const minRate = 0.5;
          const maxRate = 2.0;
          videoElem.playbackRate = Math.max(
            minRate,
            Math.min(maxRate, desiredRate)
          );
        } else {
          videoElem.playbackRate = 1;
        }
        videoElem.requestVideoFrameCallback(step);
      };
      videoElem.requestVideoFrameCallback(step);
      return () => {
        cancelled = true;
      };
    } else {
      let rafId;
      const loop = () => {
        if (cancelled) return;
        const expected = (getPlayheadMs() - startMs) / 1000;
        const drift = videoElem.currentTime - expected;
        if (Math.abs(drift) > TOL) {
          const desiredRate = 1 - drift * 0.5;
          const minRate = 0.5;
          const maxRate = 2.0;
          videoElem.playbackRate = Math.max(
            minRate,
            Math.min(maxRate, desiredRate)
          );
        } else {
          videoElem.playbackRate = 1;
        }
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
      return () => {
        cancelled = true;
        cancelAnimationFrame(rafId);
      };
    }
  }, [item.start, getPlayheadMs]);

  // Respect showOnMobile flag
  if (item.showOnMobile === false && windowWidth < 600) {
    return null;
  }

  // Build dynamic inline styles based on playlist.json fields
  const isPositioned =
    item.left !== undefined ||
    item.right !== undefined ||
    item.top !== undefined ||
    item.bottom !== undefined;

  let videoStyle = {
    // Geometry
    width: item.width !== undefined ? `${item.width}vw` : "auto",
    height: item.height !== undefined ? `${item.height}vh` : "100%",
    // Pixel‑stretch if requested
    objectFit:
      item.objectFit === "stretch" ? "fill" : item.objectFit || "cover",

    // Positioning overrides for side‑panel videos
    position: isPositioned ? "fixed" : undefined,
    top: isPositioned ? 0 : undefined,
    left:
      item.left !== undefined
        ? `${item.left}vw`
        : isPositioned
        ? undefined
        : "50%",
    right: item.right !== undefined ? `${item.right}vw` : undefined,
    transform: isPositioned ? "none" : "translateX(-50%)",

    // Layering
    zIndex: item.z || 1,
  };

  // --- Mobile override: make video cover the full viewport ---
  if (windowWidth < 600) {
    videoStyle = {
      ...videoStyle,
      width: "100vw",
      height: "100vh",
      left: 0,
      right: undefined,
      top: 0,
      position: "fixed",
      transform: "none",
      objectFit: "cover",
    };
  }

  return (
    <video
      ref={ref}
      className={styles.video}
      muted
      playsInline
      loop={false}
      preload="auto"
      style={videoStyle}
      data-start-ms={toMs(item.start)}
    />
  );
}
