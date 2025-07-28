// src/utils/hlsLoader.js
import Hls from "hls.js";

const warmed = new Set();

// Shared helpers so App.jsx and VideoLayer.jsx pick EXACTLY the same URL
export function pickFinalUrl(item, isMobile) {
  const baseUrl = isMobile
    ? item.fileMobile || item.file
    : item.fileDesktop || item.file;
  return baseUrl;
}

/**
 * Prewarm `seconds` worth of buffer then stop. Safe no-op if HLS.js isn’t supported.
 */
export function prewarmHls(url, seconds = 5) {
  return new Promise((resolve) => {
    if (warmed.has(url)) return resolve();
    warmed.add(url);

    // Native HLS support (Safari): preload metadata then resolve
    const nativeVideo = document.createElement("video");
    if (
      !Hls.isSupported() &&
      nativeVideo.canPlayType("application/vnd.apple.mpegurl")
    ) {
      nativeVideo.preload = "auto";
      nativeVideo.src = url;
      const cleanupListeners = () => {
        nativeVideo.removeEventListener("loadedmetadata", onLoaded);
        nativeVideo.removeEventListener("error", onLoaded);
        clearTimeout(timeoutId);
      };
      const onLoaded = () => {
        cleanupListeners();
        resolve();
      };
      nativeVideo.addEventListener("loadedmetadata", onLoaded);
      nativeVideo.addEventListener("error", onLoaded);
      const timeoutId = setTimeout(() => {
        cleanupListeners();
        resolve();
      }, seconds * 1000);
      return;
    }

    if (!Hls.isSupported()) return resolve();

    const video = document.createElement("video");
    const hls = new Hls({
      autoStartLoad: false,
      maxBufferLength: seconds,
      startLevel: -1,
    });
    let buffered = 0;

    const cleanup = () => {
      try {
        hls.destroy();
      } catch (_) {}
      resolve();
    };

    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      hls.startLoad(0);
    });

    hls.on(Hls.Events.FRAG_BUFFERED, (_e, data) => {
      buffered += data?.frag?.duration || 0;
      if (buffered >= seconds) {
        hls.stopLoad();
        cleanup();
      }
    });

    hls.on(Hls.Events.ERROR, () => cleanup());

    hls.loadSource(url);
  });
}
