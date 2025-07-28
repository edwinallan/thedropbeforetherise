// src/utils/assetLoader.js
// Preload progressive video via a detached <video> element so the browser
// handles byte-range (206) requests and caches the response. Resolves after
// metadata is available or after a timeout fallback.
export const preloadProgressiveVideo = (url, { timeoutMs = 8000 } = {}) => {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "auto";

    const cleanup = () => {
      // Detach and release any network activity
      try {
        video.removeAttribute("src");
        video.load();
      } catch (_) {}
    };

    const onDone = () => {
      video.removeEventListener("loadedmetadata", onDone);
      video.removeEventListener("loadeddata", onDone);
      video.removeEventListener("error", onDone);
      cleanup();
      resolve();
    };

    video.addEventListener("loadedmetadata", onDone);
    video.addEventListener("loadeddata", onDone);
    video.addEventListener("error", onDone);

    // Ensure absolute/HTTP(S) pathing matches later <video> usage
    const src = url.startsWith("http") || url.startsWith("/") ? url : `/${url}`;
    video.src = src;
    try {
      video.load();
    } catch (_) {}

    setTimeout(onDone, timeoutMs);
  });
};
// src/utils/assetLoader.js
/**
 * Preload an asset and report progress. Returns a promise that resolves when loaded.
 */
export const preloadAsset = (url, onProgress) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "blob";
    xhr.onprogress = ({ loaded, total }) => {
      if (total) onProgress?.(loaded / total);
    };
    xhr.onload = () => resolve(URL.createObjectURL(xhr.response));
    xhr.onerror = () => reject(new Error("Failed to load " + url));
    xhr.send();
  });
};
