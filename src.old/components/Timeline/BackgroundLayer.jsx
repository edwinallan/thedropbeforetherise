import React, { useEffect, useState } from 'react';
import { toMs } from '../../utils/time';
import styles from './BackgroundLayer.module.css';

export default function BackgroundLayer({ item, playhead }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const startMs = toMs(item.start);
    if (playhead >= startMs) setVisible(true);
  }, [playhead, item.start]);

  if (!visible) return null;
  return <div className={styles.bg} style={{ background: item.color, zIndex: item.z || 0 }} />;
}
