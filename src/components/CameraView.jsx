/**
 * CameraView.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-screen camera capture interface with:
 *  – Live video + canvas overlay
 *  – Real-time head-pose + distance + lighting status indicators
 *  – Grid / silhouette toggle controls
 *  – Capture button (triggers analysis and passes data up)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useCamera }          from '../hooks/useCamera.js';
import { useFaceMesh }        from '../hooks/useFaceMesh.js';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation.js';
import CameraOverlay          from './CameraOverlay.jsx';
import {
  analyseAsymmetry,
  checkFaceDistance,
} from '../utils/asymmetryCalculator.js';

/* ── Icons (inline SVG to avoid extra deps) ─────────────────────────────── */
const IconGrid      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><path d="M3 3h18v18H3z"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>;
const IconMidline   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><line x1="12" y1="2" x2="12" y2="22"/><line x1="6" y1="8" x2="18" y2="8"/><line x1="6" y1="16" x2="18" y2="16"/></svg>;
const IconDots      = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>;
const IconCapture   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>;
const IconBack      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>;

export default function CameraView({ onCapture, onBack }) {
  const videoRef       = useRef(null);
  const overlayRef     = useRef(null);

  const { startCamera, stopCamera, captureFrame, isStreaming, error: camError, videoSize } = useCamera();
  const { startMesh, stopMesh, landmarks, headPose, poseWarning, faceDetected, isReady, error: meshError } = useFaceMesh();
  const { isTilted, tiltWarning } = useDeviceOrientation();

  const [showGrid,       setShowGrid]       = useState(true);
  const [showMidline,    setShowMidline]     = useState(true);
  const [showLandmarks,  setShowLandmarks]   = useState(true);
  const [capturing,      setCapturing]       = useState(false);
  const [countdown,      setCountdown]       = useState(null);  // 3,2,1 or null
  const [captureFlash,   setCaptureFlash]    = useState(false);
  const [readyToCapture, setReadyToCapture]  = useState(false);

  /* ── Start camera + mesh on mount ─────────────────────────────────────── */
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    (async () => {
      await startCamera(videoEl);
      await startMesh(videoEl);
    })();

    return () => {
      stopCamera();
      stopMesh();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Ready check ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const poseOk = !poseWarning;
    const tiltOk = !isTilted;
    const distOk = landmarks ? checkFaceDistance(landmarks, videoSize.height).ok : false;
    setReadyToCapture(faceDetected && poseOk && tiltOk && distOk && isReady);
  }, [faceDetected, poseWarning, isTilted, landmarks, videoSize, isReady]);

  /* ── Countdown capture ────────────────────────────────────────────────── */
  const handleCapture = useCallback(() => {
    if (capturing) return;
    setCapturing(true);
    let count = 3;
    setCountdown(count);
    const interval = setInterval(() => {
      count--;
      if (count === 0) {
        clearInterval(interval);
        setCountdown(null);
        doCapture();
      } else {
        setCountdown(count);
      }
    }, 1000);
  }, [capturing]); // eslint-disable-line react-hooks/exhaustive-deps

  const doCapture = useCallback(() => {
    const overlayCanvas = overlayRef.current?.getCanvas();
    const frame = captureFrame(overlayCanvas);
    if (!frame || !landmarks) { setCapturing(false); return; }

    setCaptureFlash(true);
    setTimeout(() => setCaptureFlash(false), 300);

    const report = analyseAsymmetry(
      landmarks,
      frame.imageData,
      frame.width,
      frame.height,
    );

    stopCamera();
    stopMesh();

    setTimeout(() => {
      onCapture({ ...report, photoURL: frame.dataURL, photoW: frame.width, photoH: frame.height });
    }, 350);
  }, [captureFrame, landmarks, onCapture, stopCamera, stopMesh]);

  /* ── Status badge helpers ─────────────────────────────────────────────── */
  const statusItems = [
    {
      id: 'face',
      label: faceDetected ? 'Face detected' : 'No face',
      ok:    faceDetected,
    },
    {
      id: 'pose',
      label: poseWarning || (tiltWarning ?? 'Head straight'),
      ok:    !poseWarning && !tiltWarning,
    },
    {
      id: 'dist',
      label: (() => {
        if (!landmarks) return 'Position face';
        const d = checkFaceDistance(landmarks, videoSize.height);
        if (d.status === 'tooClose') return 'Move back';
        if (d.status === 'tooFar')   return 'Move closer';
        return 'Good distance';
      })(),
      ok: (() => {
        if (!landmarks) return false;
        return checkFaceDistance(landmarks, videoSize.height).ok;
      })(),
    },
  ];

  const activeWarning = poseWarning || tiltWarning;

  return (
    <div className="relative flex flex-col h-screen h-[100dvh] bg-black overflow-hidden">

      {/* ── Flash overlay ─────────────────────────────────────────────── */}
      {captureFlash && (
        <div className="absolute inset-0 z-50 bg-white animate-fade-in pointer-events-none" />
      )}

      {/* ── Video ─────────────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}   // mirror
        />

        {/* Canvas overlay */}
        <CameraOverlay
          ref={overlayRef}
          videoEl={videoRef.current}
          landmarks={landmarks}
          faceDetected={faceDetected}
          isReady={isReady}
          showGrid={showGrid}
          showMidline={showMidline}
          showLandmarks={showLandmarks}
        />

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-safe-top pb-3"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
          <button onClick={onBack} className="btn-icon"><IconBack /></button>

          <span className="text-white/80 text-sm font-medium tracking-wide uppercase">
            FaceAnalytics
          </span>

          {/* Toggle controls */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowGrid(v => !v)}
              className={`btn-icon ${showGrid ? 'text-amber-400' : 'text-white/50'}`}
              title="Toggle grid"
            >
              <IconGrid />
            </button>
            <button
              onClick={() => setShowMidline(v => !v)}
              className={`btn-icon ${showMidline ? 'text-cyan-400' : 'text-white/50'}`}
              title="Toggle midline"
            >
              <IconMidline />
            </button>
            <button
              onClick={() => setShowLandmarks(v => !v)}
              className={`btn-icon ${showLandmarks ? 'text-violet-400' : 'text-white/50'}`}
              title="Toggle landmarks"
            >
              <IconDots />
            </button>
          </div>
        </div>

        {/* ── Loading overlay ─────────────────────────────────────────── */}
        {!isReady && !camError && !meshError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin" />
            <p className="text-white/70 text-sm">Loading face detection model…</p>
          </div>
        )}

        {/* ── Error overlay ────────────────────────────────────────────── */}
        {(camError || meshError) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 gap-4 px-8 text-center">
            <div className="text-rose-400 text-4xl">⚠</div>
            <p className="text-white font-semibold">{camError || meshError}</p>
            <button onClick={() => window.location.reload()} className="btn-primary mt-2">
              Reload
            </button>
          </div>
        )}

        {/* ── Countdown ────────────────────────────────────────────────── */}
        {countdown !== null && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <span className="text-white text-9xl font-bold drop-shadow-lg animate-pulse">
              {countdown}
            </span>
          </div>
        )}

        {/* ── Pose warning banner ──────────────────────────────────────── */}
        {activeWarning && isReady && (
          <div className="absolute bottom-32 left-4 right-4 z-10 flex items-center justify-center">
            <div className="bg-amber-500/90 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2 max-w-sm">
              <span className="text-amber-900 text-sm font-medium text-center leading-snug">
                ⚠ {activeWarning}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom controls bar ───────────────────────────────────────── */}
      <div className="bg-black/90 backdrop-blur-md z-10 px-6 pb-safe-bottom"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>

        {/* Status chips */}
        <div className="flex gap-2 justify-center pt-3 pb-3 flex-wrap">
          {statusItems.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border
                ${s.ok
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-400'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${s.ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              {s.label}
            </div>
          ))}
        </div>

        {/* Head-pose readout */}
        {isReady && faceDetected && (
          <div className="flex justify-center gap-4 pb-3">
            {[
              { label: 'Roll',  val: headPose.roll,  thresh: 8  },
              { label: 'Yaw',   val: headPose.yaw,   thresh: 12 },
              { label: 'Pitch', val: headPose.pitch, thresh: 10 },
            ].map(({ label, val, thresh }) => (
              <div key={label} className="flex flex-col items-center">
                <span className={`text-base font-mono font-semibold
                  ${Math.abs(val) < thresh ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {val > 0 ? '+' : ''}{val}°
                </span>
                <span className="text-white/40 text-xs">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Capture button */}
        <div className="flex items-center justify-center pb-2">
          <button
            onClick={handleCapture}
            disabled={capturing}
            className={`relative w-20 h-20 rounded-full flex items-center justify-center
              transition-all duration-200 active:scale-95
              ${readyToCapture
                ? 'bg-white text-slate-900 shadow-lg shadow-white/30'
                : 'bg-white/20 text-white/40 cursor-not-allowed'}`}
          >
            {capturing && countdown === null
              ? <div className="w-8 h-8 rounded-full border-4 border-slate-900 border-t-transparent animate-spin" />
              : <IconCapture />
            }
            {/* Ready ring */}
            {readyToCapture && !capturing && (
              <span className="absolute inset-0 rounded-full border-2 border-white/60 animate-ping" />
            )}
          </button>
        </div>

        {!readyToCapture && isReady && (
          <p className="text-center text-white/40 text-xs pb-1">
            Align your face with the oval guide to enable capture
          </p>
        )}
      </div>
    </div>
  );
}
