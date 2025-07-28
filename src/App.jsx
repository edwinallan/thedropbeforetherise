// src/App.jsx
import React, { useState, useEffect } from "react";
import Landing from "./components/Landing/Landing";
import Timeline from "./components/Timeline/Timeline";
import Outro from "./components/Outro/Outro";
import playlist from "./playlist.json";
// import of old video loader removed; using HLS first-segment loader instead
import { preloadProgressiveVideo } from "./utils/assetLoader";
import { preloadAudio } from "./utils/audioLoader";
import { prewarmHls, pickFinalUrl } from "./utils/hlsLoader";

export default function App() {
  const [phase, setPhase] = useState("landing"); // 'landing' | 'timeline' | 'outro'
  const [canPlay, setCanPlay] = useState(false);
  const [loadingError, setLoadingError] = useState(false);

  const handleStart = () => {
    setPhase("timeline");
  };
  const handleEnd = () => setPhase("outro");
  const handleReplay = () => {
    setPhase("timeline");
  };

  useEffect(() => {
    let isCancelled = false;

    async function preloadInitial() {
      const mobileDevice =
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 600px)").matches;

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
            case "video": {
              // Prewarm HLS for .m3u8 and preload progressive MP4s using a hidden <video>
              promises.push(
                (async () => {
                  const url = await pickFinalUrl(item, mobileDevice);
                  if (/\.m3u8$/i.test(url)) {
                    await prewarmHls(url, 5);
                  } else if (url) {
                    const fullUrl =
                      url.startsWith("http") || url.startsWith("/")
                        ? url
                        : `/${url}`;
                    await preloadProgressiveVideo(fullUrl);
                  }
                })()
              );
              break;
            }
            case "audio": {
              // Pick audio quality based on network speed
              const connection =
                navigator.connection ||
                navigator.mozConnection ||
                navigator.webkitConnection;
              const type = connection?.effectiveType;
              let url;
              if (type === "slow-2g" || type === "2g") {
                url = item.low || item.file;
              } else if (type === "3g") {
                url = item.medium || item.low || item.file;
              } else {
                url = item.high || item.file;
              }
              if (url) {
                // Prefix with slash to ensure correct absolute path
                const fullUrl =
                  url.startsWith("http") || url.startsWith("/")
                    ? url
                    : `/${url}`;
                promises.push(preloadAudio(fullUrl));
              }
              break;
            }
            default:
              break;
          }
        });

        await Promise.all(promises);
        if (!isCancelled) setCanPlay(true);
      } catch (err) {
        console.error("Initial preload failed:", err);
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
      {phase === "landing" && (
        <Landing
          onStart={handleStart}
          canPlay={canPlay}
          loadingError={loadingError}
        />
      )}
      {phase === "timeline" && (
        <>
          <Timeline onComplete={handleEnd} onReplay={handleReplay} />
        </>
      )}
      {phase === "outro" && <Outro onReplay={handleReplay} />}
    </>
  );
}
