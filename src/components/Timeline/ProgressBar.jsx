// src/components/Timeline/ProgressBar.jsx
import React from "react";
import styles from "./ProgressBar.module.css";
import { toMs } from "../../utils/time";
import { getContrastColor } from "../../utils/colorUtils";

/**
 * Progress bar with chapter ticks and tooltips.
 */
export default function ProgressBar({
  time,
  total,
  chapters,
  bgColor,
  onSeek,
  onScrubStart,
  onScrubEnd,
}) {
  const fillColor = getContrastColor(bgColor);
  const barColor = getContrastColor(fillColor);

  const percent = total ? (time / total) * 100 : 0;

  const handlePointerDown = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    if (onScrubStart) onScrubStart();

    const update = (clientX) => {
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      if (onSeek) onSeek(pct * total);
    };

    update(e.clientX);

    const move = (ev) => update(ev.clientX);
    const up = (ev) => {
      update(ev.clientX);
      if (onScrubEnd) onScrubEnd();
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
      <div className={styles.bar} style={{ background: barColor }}>
        <div
          className={styles.progress}
          style={{ width: percent + "%", background: fillColor }}
        >
          {chapters.map((c, idx) => (
            <div
              key={`top-${idx}`}
              className={styles.tickTop}
              style={{
                left: `${(toMs(c.start) / time) * 100}%`,
                backgroundColor: barColor,
              }}
            />
          ))}
        </div>
        {chapters.map((c, idx) => (
          <div
            key={idx}
            className={styles.chapterWrapper}
            style={{ left: `${(toMs(c.start) / total) * 100}%` }}
          >
            <div
              className={styles.tick}
              style={{ backgroundColor: fillColor }}
            />
            <div
              className={`${styles.title} ${styles.titleMobile}`}
              style={{ color: fillColor, zIndex: 10 }}
            >
              {c.title.toUpperCase()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
