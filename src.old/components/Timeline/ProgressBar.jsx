// src/components/Timeline/ProgressBar.jsx
import React from "react";
import styles from "./ProgressBar.module.css";
import { toMs } from "../../utils/time";

/**
 * Progress bar with chapter ticks and tooltips.
 */
export default function ProgressBar({
  time,
  total,
  chapters,
  barColor,
  onSeek,
}) {
  const percent = total ? (time / total) * 100 : 0;

  const handlePointerDown = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();

    const update = (clientX) => {
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      if (onSeek) onSeek(pct * total);
    };

    update(e.clientX);

    const move = (ev) => update(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className={styles.scrubZone}
      onPointerDown={handlePointerDown}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.progress} style={{ background: barColor }}>
        <div
          className={styles.fill}
          style={{ width: percent + "%", background: barColor }}
        />
        {chapters.map((c, idx) => (
          <div
            key={idx}
            className={styles.chapterWrapper}
            style={{ left: `${(toMs(c.start) / total) * 100}%` }}
          >
            <div className={styles.tick} />
            <div
              className={`${styles.title} ${styles.titleMobile}`}
              style={{ color: barColor }}
            >
              {c.title.toUpperCase()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
