// src/components/Landing/Landing.jsx

import React, { useRef, useState, useEffect } from "react";
import styles from "./Landing.module.css";
import { useParallax } from "../../hooks/useParallax";
import { track } from "../../utils/analytics";

export default function Landing({ onStart, canPlay, loadingError }) {
  const headlineRef = useRef(null);
  const buttonRef = useRef(null);
  const containerRef = useRef(null);
  const [waitingForAssets, setWaitingForAssets] = useState(false);

  useEffect(() => {
    if (waitingForAssets && canPlay) {
      track("begin_playback");
      onStart();
    }
  }, [waitingForAssets, canPlay, onStart]);

  // Enable mouse parallax (disabled on touch)
  useParallax([containerRef], 25);

  const handleClick = () => {
    setWaitingForAssets(true);
    // Animate headline sliding down immediately
    if (headlineRef.current) {
      headlineRef.current.classList.add(styles.slideDownHeadline);
    }
    // Animate button sliding down after 100ms
    setTimeout(() => {
      if (buttonRef.current) {
        buttonRef.current.classList.add(styles.slideDownButton);
      }
    }, 100);
  };

  return (
    <div ref={containerRef} className={styles.container}>
      <h1 ref={headlineRef} className={styles.headline}>
        GET IN BEFORE THE WORLD DOES
      </h1>
      <button ref={buttonRef} className={styles.listen} onClick={handleClick}>
        <span className={styles.icon}>►</span>
        <span>listen</span>
      </button>

      {waitingForAssets && !canPlay && (
        <div className={styles.loader}>Loading…</div>
      )}
      {loadingError && (
        <div className={styles.error}>
          Failed to load assets. Please refresh.
        </div>
      )}

      {/* Black overlay that fades out over 2 s to mask font swap */}
      <div className={styles.fadeOverlay} />
    </div>
  );
}
