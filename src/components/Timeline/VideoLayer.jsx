import React, { useEffect, useRef, useState } from 'react';
import { toMs } from '../../utils/time';
import styles from './VideoLayer.module.css';
import Hls from 'hls.js';

export default function VideoLayer({ item, playhead }) {
  const ref = useRef(null);
  const playedRef = useRef(false);
  // Keep the latest playhead value in a ref for syncing
  const playheadRef = useRef(playhead);

  // Track window width for showOnMobile
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1000
  );
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);

  // Initialize video source (HLS or standard)
  useEffect(() => {
    if (!ref.current) return;
    const videoElem = ref.current;

    const url = item.file;
    // Only use HLS for .m3u8 streams; play .mp4 and .webm natively
    const isHls = /\.m3u8$/i.test(url);
    if (isHls) {
      console.log(`[VideoLayer] ${url} → using HLS pipeline`);
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(videoElem);
      } else if (videoElem.canPlayType('application/vnd.apple.mpegurl')) {
        videoElem.src = url;
      } else {
        console.error(`[VideoLayer] HLS not supported for ${url}`);
      }
    } else {
      console.log(`[VideoLayer] ${url} → using native playback`);
      videoElem.src = url;
    }
  }, [item.file]);

  // Debug: log basic play‑state and errors for this video element
  useEffect(() => {
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
  }, [item.file]);

  // Playback control according to playhead
  useEffect(() => {
    const startMs = toMs(item.start);
    const endMs = item.duration ? startMs + toMs(item.duration) : Infinity;
    if (ref.current) {
      const videoElem = ref.current;

      const startPlayback = () => {
        // Align precisely with the latest global playhead
        videoElem.currentTime = (playheadRef.current - startMs) / 1000;
        videoElem.play().catch(() => {});
        playedRef.current = true;
        videoElem.removeEventListener('canplay', startPlayback);
      };

      if (playhead >= startMs && !playedRef.current) {
        // Wait until enough data has buffered for a clean start
        if (videoElem.readyState >= 2) {
          startPlayback();
        } else {
          videoElem.addEventListener('canplay', startPlayback, { once: true });
        }
      }

      if (playhead >= endMs && !videoElem.paused) {
        videoElem.pause();
      }
    }
  }, [playhead, item]);

  useEffect(() => {
    const videoElem = ref.current;
    if (!videoElem) return;
    const startMs = toMs(item.start);
    // Every second, ensure the video is in sync with the timeline
    const id = setInterval(() => {
      if (playedRef.current && !videoElem.paused) {
        const expected = (playheadRef.current - startMs) / 1000;
        // If drift > 0.5s, re-sync
        const drift = videoElem.currentTime - expected;
        if (Math.abs(drift) > 0.5) {
          console.log(
            `VideoLayer drift: item=${item.file} drift=${drift.toFixed(3)}s, correcting to ${expected.toFixed(3)}s`
          );
          videoElem.currentTime = expected;
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [item.start]);

  // Respect showOnMobile flag
  if (item.showOnMobile === false && windowWidth < 600) {
    return null;
  }

  // Build dynamic inline styles based on playlist.json fields
  const isPositioned = item.left !== undefined || item.right !== undefined || item.top !== undefined || item.bottom !== undefined;

  const videoStyle = {
    // Geometry
    width: item.width !== undefined ? `${item.width}vw` : 'auto',
    height: item.height !== undefined ? `${item.height}vh` : '100%',
    // Pixel‑stretch if requested
    objectFit: item.objectFit === 'stretch' ? 'fill' : (item.objectFit || 'cover'),

    // Positioning overrides for side‑panel videos
    position: isPositioned ? 'fixed' : undefined,
    top: isPositioned ? 0 : undefined,
    left: item.left !== undefined ? `${item.left}vw` : (isPositioned ? undefined : '50%'),
    right: item.right !== undefined ? `${item.right}vw` : undefined,
    transform: isPositioned ? 'none' : 'translateX(-50%)',

    // Layering
    zIndex: item.z || 1,
  };

  return (
    <video
      ref={ref}
      className={styles.video}
      muted
      playsInline
      loop={false}
      preload="metadata"
      style={videoStyle}
      data-start-ms={toMs(item.start)}
    />
  );
}
