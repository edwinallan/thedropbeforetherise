// src/utils/audioLoader.js
/**
 * Preload an audio file via an offscreen HTMLAudioElement.
 * Returns a Promise that resolves with the audio element once canplaythrough.
 */
export const preloadAudio = (url) => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.src = url;
    audio.preload = "auto";
    audio.addEventListener(
      "canplaythrough",
      () => {
        resolve(audio);
      },
      { once: true }
    );
    audio.addEventListener(
      "error",
      () => {
        reject(new Error(`Audio failed to load: ${url}`));
      },
      { once: true }
    );
    audio.load();
  });
};
