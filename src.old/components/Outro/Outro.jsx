import React, { useRef } from 'react';
import styles from './Outro.module.css';
import { useParallax } from '../../hooks/useParallax';
import { track } from '../../utils/analytics';

export default function Outro({ onReplay, showReplay = true }) {
  const replayRef = useRef(null);
  const joinRef = useRef(null);
  const iconsRef = useRef(null);
  const outroRef = useRef(null);

  useParallax([joinRef], 25);

  const handleReplay = () => {
    track('replay');
    onReplay();
  };

  return (
    <div className={styles.container}>
      <div className={styles.panel}  ref={outroRef}>
        <a
          ref={joinRef}
          className={styles.join}
          href="mailto:doane@allan.ch?subject=I'd%20like%20to%20collaborate%20with%20you"
          onClick={() => track('contact')}
        >
        JOIN
        </a>
      </div>
      <div ref={iconsRef} className={styles.icons}>
        {/* SVG placeholders */}
        {['instagram','tiktok','spotify','apple'].map((n)=><span key={n}>{n}</span>)}
      </div>
      {showReplay && (
        <div ref={replayRef} className={styles.column} onClick={handleReplay}>
          <span className={styles.icon}>⟳</span>
          <span>REPLAY</span>
        </div>
      )}
    </div>
  );
}
