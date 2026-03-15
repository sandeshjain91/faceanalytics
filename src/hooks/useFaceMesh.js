/**
 * useFaceMesh.js
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook that wraps the MediaPipe FaceMesh (via CDN) and exposes:
 *   - landmarks   : latest 468+ normalised points (or null)
 *   - headPose    : { roll, yaw, pitch } in degrees
 *   - poseWarning : human-readable warning string or null
 *   - isReady     : bool – model loaded
 *   - error       : string or null
 *   - startMesh(videoEl, canvasEl)  – begin processing
 *   - stopMesh()                    – tear down
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { estimateHeadPose } from '../utils/asymmetryCalculator.js';

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/';

/* tolerance thresholds (degrees) */
const ROLL_LIMIT  = 8;
const YAW_LIMIT   = 12;
const PITCH_LIMIT = 10;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.crossOrigin = 'anonymous';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

export function useFaceMesh() {
  const faceMeshRef  = useRef(null);
  const cameraRef    = useRef(null);
  const rafRef       = useRef(null);
  const mountedRef   = useRef(true);

  const [landmarks,   setLandmarks]   = useState(null);
  const [headPose,    setHeadPose]    = useState({ roll: 0, yaw: 0, pitch: 0 });
  const [poseWarning, setPoseWarning] = useState(null);
  const [isReady,     setIsReady]     = useState(false);
  const [error,       setError]       = useState(null);
  const [faceDetected,setFaceDetected]= useState(false);

  // ── Build pose warning string from angles ─────────────────────────────────
  const buildWarning = useCallback((pose) => {
    const msgs = [];
    if (Math.abs(pose.roll)  > ROLL_LIMIT)  msgs.push(`Tilt ${pose.roll > 0 ? 'right' : 'left'} (${Math.abs(pose.roll).toFixed(1)}°)`);
    if (Math.abs(pose.yaw)   > YAW_LIMIT)   msgs.push(`Turn ${pose.yaw  > 0 ? 'right' : 'left'} (${Math.abs(pose.yaw).toFixed(1)}°)`);
    if (Math.abs(pose.pitch) > PITCH_LIMIT) msgs.push(`${pose.pitch > 0 ? 'Tilt chin up' : 'Tilt chin down'} (${Math.abs(pose.pitch).toFixed(1)}°)`);
    return msgs.length ? msgs.join(' · ') : null;
  }, []);

  // ── onResults callback for MediaPipe ─────────────────────────────────────
  const onResults = useCallback((results) => {
    if (!mountedRef.current) return;

    if (!results.multiFaceLandmarks?.length) {
      setLandmarks(null);
      setFaceDetected(false);
      setPoseWarning('No face detected – position your face in the oval guide');
      return;
    }

    const lm   = results.multiFaceLandmarks[0];
    const pose = estimateHeadPose(lm);

    setLandmarks(lm);
    setFaceDetected(true);
    setHeadPose(pose);
    setPoseWarning(buildWarning(pose));
  }, [buildWarning]);

  // ── startMesh ────────────────────────────────────────────────────────────
  const startMesh = useCallback(async (videoEl) => {
    if (!videoEl) return;
    try {
      // Load MediaPipe scripts from CDN
      await loadScript(`${MEDIAPIPE_CDN}face_mesh.js`);

      // eslint-disable-next-line no-undef
      const fm = new FaceMesh({
        locateFile: (file) => `${MEDIAPIPE_CDN}${file}`,
      });

      fm.setOptions({
        maxNumFaces:          1,
        refineLandmarks:      true,     // enables iris (pts 468–477)
        minDetectionConfidence: 0.6,
        minTrackingConfidence:  0.6,
      });

      fm.onResults(onResults);
      await fm.initialize();

      faceMeshRef.current = fm;

      if (mountedRef.current) setIsReady(true);

      // ── Inference loop using requestAnimationFrame ──────────────────────
      const loop = async () => {
        if (!mountedRef.current) return;
        if (videoEl.readyState >= 2) {
          await fm.send({ image: videoEl });
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);

    } catch (err) {
      console.error('[useFaceMesh]', err);
      if (mountedRef.current) setError('Failed to load face detection model. Check your connection.');
    }
  }, [onResults]);

  // ── stopMesh ─────────────────────────────────────────────────────────────
  const stopMesh = useCallback(() => {
    if (rafRef.current)    cancelAnimationFrame(rafRef.current);
    if (faceMeshRef.current) {
      try { faceMeshRef.current.close(); } catch (_) {}
    }
    faceMeshRef.current = null;
    cameraRef.current   = null;
  }, []);

  // cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopMesh();
    };
  }, [stopMesh]);

  return {
    landmarks,
    headPose,
    poseWarning,
    faceDetected,
    isReady,
    error,
    startMesh,
    stopMesh,
  };
}
