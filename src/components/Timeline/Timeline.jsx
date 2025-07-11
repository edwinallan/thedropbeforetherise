import React, { useEffect, useRef, useState } from 'react';
import styles from './Timeline.module.css';
import ProgressBar from './ProgressBar';
import BackgroundLayer from './BackgroundLayer';
import VideoLayer from './VideoLayer';
import AudioLayer from './AudioLayer';
import { toMs } from '../../utils/time';
import playlist from '../../playlist.json';
import { track } from '../../utils/analytics';
import { getContrastColor } from '../../utils/colorUtils';

/**
 * Main Timeline player component.
 * - Tracks a “muted” boolean in state.
 * - OnClick anywhere in the stage (except inside any <button>), toggles “muted”.
 * - Passes muted={muted} down to every <AudioLayer>.
 */
export default function Timeline({ onComplete }) {
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const baseRef = useRef(performance.now());
  const rafRef = useRef();

  // Compute total duration once
  const totalDuration = React.useMemo(() => {
    return playlist.items.reduce((max, item) => {
      const start = toMs(item.start);
      const dur = toMs(item.duration || 0);
      return Math.max(max, start + dur);
    }, 0);
  }, []);

  // Start the “playhead” loop and send GA event
  useEffect(() => {
    if (!isPlaying) return;

    track('begin_playback', { totalDuration });

    const loop = () => {
      const now = performance.now();
      setTime(now - baseRef.current);

      if (now - baseRef.current >= totalDuration) {
        cancelAnimationFrame(rafRef.current);
        onComplete();
        track('progress', { percent: 100 });
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, totalDuration, onComplete]);

  // Handle anywhere‑click on the stage: toggle play/pause
  const handleClick = (e) => {
    if (e.target.closest('button')) return;

    setIsPlaying((prev) => {
      const next = !prev;

      if (next) {
        // Resume playback
        baseRef.current = performance.now() - time;
        track('resume_playback');
        document.querySelectorAll('video, audio').forEach((el) => {
          el.play().catch(() => {});
        });
      } else {
        // Pause playback
        track('pause_playback');
        document.querySelectorAll('video, audio').forEach((el) => el.pause());
      }

      return next;
    });
  };

  // Seek to a specific moment (ms) – used by ProgressBar scrubbing
  const handleSeek = (ms) => {
    const clamped = Math.max(0, Math.min(ms, totalDuration));
    setTime(clamped);
    baseRef.current = performance.now() - clamped;
    track('seek', { percent: (clamped / totalDuration) * 100 });

    // Re‑sync media
    document.querySelectorAll('video, audio').forEach((el) => el.pause());
    if (isPlaying) {
      setTimeout(() => {
        document.querySelectorAll('video, audio').forEach((el) =>
          el.play().catch(() => {})
        );
      }, 0);
    }
  };

  // Determine current background color from playlist items
  const currentBgColor = React.useMemo(() => {
    // Filter for background items whose start time is <= current time
    const bgItems = playlist.items
      .filter((item) => item.type === 'background')
      .map((item) => ({
        color: item.color,
        startMs: toMs(item.start),
      }))
      .filter((entry) => time >= entry.startMs);
    // If no background is active yet, default to black
    if (bgItems.length === 0) return '#000000';
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

  // Build all layers, passing `muted` into AudioLayer
  const layers = playlist.items.map((item, idx) => {
    switch (item.type) {
      case 'background':
        return <BackgroundLayer key={idx} item={item} playhead={time} />;
      case 'video':
        return <VideoLayer key={idx} item={item} playhead={time} />;
      case 'audio':
        return (
          <AudioLayer
            key={idx}
            item={item}
            playhead={time}
          />
        );
      default:
        return null;
    }
  });

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
    </div>
  );
}