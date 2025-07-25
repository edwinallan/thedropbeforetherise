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
