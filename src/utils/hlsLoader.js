// src/utils/hlsLoader.js

import Hls from "hls.js";

/**
 * Preload the first segment of an HLS stream.
 * Returns a Promise that resolves once the first fragment is loaded (or immediately on error).
 */
export function preloadHlsFirstSegment(url) {
  return new Promise((resolve) => {
    if (!Hls.isSupported()) {
      // If HLS.js isn’t supported (e.g. non‐MSE browsers), resolve immediately
      resolve();
      return;
    }
    const video = document.createElement("video");
    const hls = new Hls();
    hls.attachMedia(video);

    // Once the first segment is loaded, clean up and resolve
    const onFragLoad = (_event, data) => {
      resolve();
      hls.off(Hls.Events.FRAG_LOADED, onFragLoad);
      hls.destroy();
    };
    hls.on(Hls.Events.FRAG_LOADED, onFragLoad);

    // On any fatal error, also resolve so we don’t block playback
    hls.on(Hls.Events.ERROR, (_event, data) => {
      resolve();
      hls.destroy();
    });

    hls.loadSource(url);
    hls.startLoad(0); // load the first fragment
  });
}
