// src/utils/hlsLoader.js
import Hls from "hls.js";

let _hevcSupport = undefined;
const warmed = new Set();

// Shared helpers so App.jsx and VideoLayer.jsx pick EXACTLY the same URL
export async function supportsHevc() {
  if (_hevcSupport !== undefined) return _hevcSupport;
  let supported = false;
  if (navigator.mediaCapabilities && navigator.mediaCapabilities.decodingInfo) {
    try {
      const info = await navigator.mediaCapabilities.decodingInfo({
        type: "file",
        video: {
          contentType: 'video/mp4; codecs="hvc1"',
          width: 1920,
          height: 1080,
          bitrate: 8000000,
          framerate: 30,
        },
      });
      supported = !!info.supported;
    } catch (_) {}
  }
  if (!supported) {
    const v = document.createElement("video");
    supported =
      v.canPlayType('video/mp4; codecs="hvc1"') !== "" ||
      v.canPlayType('video/mp4; codecs="hev1"') !== "";
  }
  _hevcSupport = supported;
  return supported;
}

export async function pickFinalUrl(item, isMobile) {
  const baseUrl = isMobile
    ? item.fileMobile || item.file
    : item.fileDesktop || item.file;

  const hevcOk = item.fileHevc ? await supportsHevc() : false;

  if (hevcOk && item.fileHevc) return item.fileHevc;
  if (item.fileH264) return item.fileH264;
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
