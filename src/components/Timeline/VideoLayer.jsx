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
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playedRef = useRef(false);

  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1000
  );
  useEffect(() => {
    const cb = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", cb);
    return () => window.removeEventListener("resize", cb);
  }, []);

  // Register with Timeline so it can manage seeks & duration
  useEffect(() => {
    if (videoRef.current && registerMedia) {
      registerMedia(videoRef.current, item, { isMaster: false });
    }
  }, [registerMedia, item]);

  // Attach source once (native HLS on Safari, Hls.js elsewhere)
  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;

    (async () => {
      const url = await pickFinalUrl(item, windowWidth < 600);
      if (cancelled || !video) return;
      const isHls = /\.m3u8$/i.test(url);

      if (isHls) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
        } else if (Hls.isSupported()) {
          const hls = new Hls();
          hlsRef.current = hls;
          hls.attachMedia(video);
          hls.loadSource(url);
        } else {
          console.warn("[VideoLayer] HLS not supported: ", url);
        }
      } else {
        video.src =
          url.startsWith("http") || url.startsWith("/") ? url : `/${url}`;
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
  }, [item, windowWidth]);

  // Report buffering so Timeline can show a global loader
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onBufferingChange) return;

    const setBuf = (val) => onBufferingChange && onBufferingChange(val);

    const onWaiting = () => setBuf(true);
    const onStalled = () => setBuf(true);
    const onPlaying = () => setBuf(false);
    const onCanPlay = () => setBuf(false);
    const onEnded = () => setBuf(false);

    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onStalled);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("ended", onEnded);
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

  // Respect showOnMobile flag
  if (item.showOnMobile === false && windowWidth < 600) {
    return null;
  }

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

  return (
    <video
      ref={videoRef}
      className={styles.video}
      muted
      playsInline
      loop={false}
      preload="auto"
      style={style}
      data-start-ms={toMs(item.start)}
    />
  );
}
