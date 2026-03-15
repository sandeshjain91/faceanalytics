/**
 * useCamera.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages device camera access.
 * – Requests the front-facing camera at the highest supported resolution.
 * – Exposes start / stop / capture functions.
 * – Reports whether the device is in portrait vs landscape orientation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useRef, useState, useCallback, useEffect } from 'react';

export function useCamera() {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  const [isStreaming,  setIsStreaming]  = useState(false);
  const [error,        setError]        = useState(null);
  const [videoSize,    setVideoSize]    = useState({ width: 640, height: 480 });
  const [orientation,  setOrientation]  = useState('portrait');

  // ── Orientation ───────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── startCamera ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async (videoEl) => {
    if (!videoEl) return;
    videoRef.current = videoEl;

    try {
      const constraints = {
        video: {
          facingMode: 'user',
          width:      { ideal: 1280, max: 1920 },
          height:     { ideal: 720,  max: 1080 },
          frameRate:  { ideal: 30 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      videoEl.srcObject = stream;
      videoEl.setAttribute('playsinline', true);
      await videoEl.play();

      const track       = stream.getVideoTracks()[0];
      const settings    = track.getSettings();
      setVideoSize({ width: settings.width || 640, height: settings.height || 480 });
      setIsStreaming(true);
      setError(null);
    } catch (err) {
      console.error('[useCamera]', err);
      let msg = 'Camera access denied.';
      if (err.name === 'NotFoundError')     msg = 'No camera found on this device.';
      if (err.name === 'NotAllowedError')   msg = 'Camera permission denied. Please allow camera access and reload.';
      if (err.name === 'NotReadableError')  msg = 'Camera is in use by another application.';
      setError(msg);
    }
  }, []);

  // ── stopCamera ───────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  // ── captureFrame ─────────────────────────────────────────────────────────
  /**
   * Draws the current video frame to an offscreen canvas and returns
   * { dataURL, imageData, width, height }.
   */
  const captureFrame = useCallback((overlayCanvasEl) => {
    const video = videoRef.current;
    if (!video) return null;

    const w = video.videoWidth  || videoSize.width;
    const h = video.videoHeight || videoSize.height;

    const offscreen = document.createElement('canvas');
    offscreen.width  = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');

    // Mirror to match what the user sees
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    // Optionally composite the landmark overlay
    if (overlayCanvasEl) {
      ctx.drawImage(overlayCanvasEl, 0, 0, w, h);
    }

    const imageData = ctx.getImageData(0, 0, w, h);
    const dataURL   = offscreen.toDataURL('image/jpeg', 0.92);

    return { dataURL, imageData, width: w, height: h };
  }, [videoSize]);

  // cleanup
  useEffect(() => () => stopCamera(), [stopCamera]);

  return {
    videoRef,
    isStreaming,
    error,
    videoSize,
    orientation,
    startCamera,
    stopCamera,
    captureFrame,
  };
}
