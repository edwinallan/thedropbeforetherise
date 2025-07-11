// src/utils/videoLoader.js

import { preloadAsset } from "./assetLoader";

/**
 * Preload a low-res video by fetching it as a blob.
 * Returns a Promise that resolves with the blob URL.
 */
export const preloadLowResVideo = (url) => {
  return preloadAsset(url);
};

/**
 * Preload a high-res video by fetching it as a blob.
 * When ready, calls onCanPlay callback with the blob URL.
 */
export const preloadHighResVideo = (url, onCanPlay) => {
  preloadAsset(url)
    .then((blobUrl) => {
      onCanPlay(blobUrl);
    })
    .catch((err) => {
      console.warn(`High-res failed to load: ${url}`, err);
    });
};
