import React, { useState, useEffect } from 'react';
import Landing from './components/Landing/Landing';
import Timeline from './components/Timeline/Timeline';
import Outro from './components/Outro/Outro';
import playlist from './playlist.json';
// import of old video loader removed; using HLS first-segment loader instead
import { preloadHlsFirstSegment } from './utils/hlsLoader';
import { preloadAsset } from './utils/assetLoader';

export default function App() {
  const [phase, setPhase] = useState('landing'); // 'landing' | 'timeline' | 'outro'
  const [canPlay, setCanPlay] = useState(false);
  const [loadingError, setLoadingError] = useState(false);

  const handleStart = () => setPhase('timeline');
  const handleEnd = () => setPhase('outro');
  const handleReplay = () => setPhase('timeline');

  useEffect(() => {
    let isCancelled = false;

    async function preloadInitial() {
      const mobileDevice =
        typeof window !== 'undefined' &&
        window.matchMedia('(max-width: 600px)').matches;

      try {
        const promises = [];

        playlist.items.forEach((item) => {
          // Skip assets that will never be displayed on this device
          if (
            (item.showOnMobile === false && mobileDevice) ||
            (item.showOnMobile === true && !mobileDevice)
          ) {
            return; // do not preload irrelevant asset
          }

          switch (item.type) {
            case 'video':
              // Preload the first HLS segment or full video file
              if (item.file && item.file.endsWith('.m3u8')) {
                promises.push(preloadHlsFirstSegment(item.file));
              } else if (item.file) {
                promises.push(preloadAsset(item.file));
              }
              break;
            case 'audio':
              if (item.file) {
                // Fully load audio file before starting
                promises.push(preloadAsset(item.file));
              }
              break;
            default:
              break;
          }
        });

        await Promise.all(promises);
        if (!isCancelled) setCanPlay(true);
      } catch (err) {
        console.error('Initial preload failed:', err);
        if (!isCancelled) setLoadingError(true);
      }
    }

    preloadInitial();
    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <>
      {phase === 'landing' && (
        <Landing onStart={handleStart} canPlay={canPlay} loadingError={loadingError} />
      )}
      {phase === 'timeline' && <Timeline onComplete={handleEnd} />}
      {phase === 'outro' && <Outro onReplay={handleReplay} />}
    </>
  );
}