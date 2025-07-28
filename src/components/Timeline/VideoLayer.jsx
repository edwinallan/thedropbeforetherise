// src/components/Timeline/VideoLayer.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import Hls from "hls.js";
import { toMs } from "../../utils/time";
import styles from "./VideoLayer.module.css";

import { pickFinalUrl } from "../../utils/hlsLoader";

export default function VideoLayer({
  item,
  playhead,
  registerMedia,
  onBufferingChange,
  isMaster = false,
  forceHlsJs = true,
  replayToken = 0,
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playedRef = useRef(false);

  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1000
  );
  const isMobile = windowWidth < 600;
  useEffect(() => {
    const cb = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", cb);
    return () => window.removeEventListener("resize", cb);
  }, []);

  // Register with Timeline so it can manage seeks & duration
  useEffect(() => {
    if (videoRef.current && registerMedia) {
      registerMedia(videoRef.current, item, { isMaster });
    }
  }, [registerMedia, item, isMaster]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Reset one-shot play guard and ensure we're not stuck at end
    playedRef.current = false;
    try {
      video.pause();
    } catch (err) {
      console.warn("[VideoLayer] pause() on replay failed", item.start, err);
    }
    try {
      // Seek to 0 so we don't flash the last frame
      video.currentTime = 0;
      // Note: Timeline will start the master; others start when in window
    } catch (err) {
      console.error("[VideoLayer] error seeking on replay", item.start, err);
    }
  }, [replayToken, item.start, isMaster]);

  // Attach source once (native HLS on Safari, Hls.js elsewhere)
  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;

    (async () => {
      const url = await pickFinalUrl(item, isMobile);
      if (cancelled || !video) return;
      const isHls = /\.m3u8$/i.test(url);

      // Ensure CORS for HLS segments
      video.crossOrigin = "anonymous";
      // Show loader on initial load
      onBufferingChange(true);

      if (isHls) {
        if (video.canPlayType("application/vnd.apple.mpegurl") && !forceHlsJs) {
          video.src = url;
          // Register before load() to avoid missing the event
          video.addEventListener(
            "canplay",
            () => {
              video.play().catch(() => {});
            },
            { once: true }
          );
          video.load();
        } else if (Hls.isSupported()) {
          const hls = new Hls();
          hlsRef.current = hls;
          hls.attachMedia(video);
          hls.loadSource(url);
          hls.on(Hls.Events.ERROR, () => {});
          // Surface HLS buffering events before manifest parsed handler
          hls.on(Hls.Events.BUFFER_STALLED, () => onBufferingChange(true));
          hls.on(Hls.Events.FRAG_BUFFERED, () => onBufferingChange(false));
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            // Sync start: play and clear buffering when manifest is ready
            onBufferingChange(false);
            video.play().catch(() => {});
          });
        }
      } else {
        video.src =
          url.startsWith("http") || url.startsWith("/") ? url : `/${url}`;
        // Show loader on initial load for non-HLS segments
        onBufferingChange(true);
        video.load();
      }
    })();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (_) {}
        hlsRef.current = null;
      }
    };
  }, [item, isMobile]);

  // Report buffering so Timeline can show a global loader
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onBufferingChange) return;

    const setBuf = (val) => onBufferingChange && onBufferingChange(val);

    const onWaiting = () => {
      const videoEl = videoRef.current;
      if (videoEl) {
        if (videoEl.buffered.length > 0) {
          const curr = videoEl.currentTime;
          for (let i = 0; i < videoEl.buffered.length; i++) {
            const start = videoEl.buffered.start(i);
            const end = videoEl.buffered.end(i);
            if (curr >= start && curr <= end - 0.1) {
              return;
            }
          }
        }
      }
      setBuf(true);
    };
    const onStalled = () => {
      const videoEl = videoRef.current;
      if (videoEl && videoEl.buffered.length > 0) {
        const curr = videoEl.currentTime;
        for (let i = 0; i < videoEl.buffered.length; i++) {
          const start = videoEl.buffered.start(i);
          const end = videoEl.buffered.end(i);
          if (curr >= start && curr <= end - 0.1) {
            return;
          }
        }
      }
      setBuf(true);
    };
    const onPlaying = () => setBuf(false);
    const onCanPlay = () => setBuf(false);
    const onEnded = () => setBuf(false);

    // Log progress event for buffering progress
    const onProgress = () => {
      const videoEl = videoRef.current;
      if (videoEl) {
      }
    };

    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onStalled);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("ended", onEnded);
    video.addEventListener("progress", onProgress);

    const onLoadedMetadata = () => {};
    const onError = () => {};
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("error", onError);
    };
  }, [onBufferingChange]);

  // Simple sync with global playhead
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const startMs = toMs(item.start);
    const endMs = item.duration ? startMs + toMs(item.duration) : Infinity;

    if (playhead >= startMs && playhead < endMs) {
      const desired = (playhead - startMs) / 1000;
      if (Math.abs(video.currentTime - desired) > 0.04) {
        try {
          video.currentTime = desired;
        } catch (_) {}
      }
      if (!playedRef.current) {
        video.play().catch(() => {});
        playedRef.current = true;
      }
    } else {
      if (!video.paused) {
        try {
          video.pause();
        } catch (_) {}
      }
    }
  }, [playhead, item]);

  // Build dynamic inline styles from playlist.json fields
  const isPositioned =
    item.left !== undefined ||
    item.right !== undefined ||
    item.top !== undefined ||
    item.bottom !== undefined;

  const style = useMemo(() => {
    let vs = {
      width: item.width !== undefined ? `${item.width}vw` : "auto",
      height: item.height !== undefined ? `${item.height}vh` : "100%",
      objectFit:
        item.objectFit === "stretch" ? "fill" : item.objectFit || "cover",
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
      zIndex: item.z || 1,
    };

    if (windowWidth < 600) {
      vs = {
        ...vs,
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

    return vs;
  }, [
    item.width,
    item.height,
    item.objectFit,
    item.left,
    item.right,
    item.top,
    item.bottom,
    item.z,
    isPositioned,
    windowWidth,
  ]);

  // Respect showOnMobile flag
  if (item.showOnMobile === false && windowWidth < 600) {
    return null;
  }

  return (
    <video
      autoPlay={isMaster}
      playsInline
      crossOrigin="anonymous"
      webkit-playsinline="true"
      ref={videoRef}
      className={styles.video}
      loop={false}
      preload="auto"
      style={style}
      data-start-ms={toMs(item.start)}
    />
  );
}
