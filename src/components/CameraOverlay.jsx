/**
 * CameraOverlay.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Draws on a <canvas> element that is layered on top of the <video> stream.
 * Renders:
 *   1. Face silhouette guide (oval)
 *   2. Golden-Ratio / Rule-of-Thirds grid
 *   3. Real-time MediaPipe landmark tessellation + key points
 *   4. Facial midline
 *   5. Bilateral distance lines
 *
 * The canvas is sized to match the video element via ResizeObserver.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { LANDMARK_INDICES, BILATERAL_PAIRS } from '../utils/asymmetryCalculator.js';

/* ── Drawing constants ───────────────────────────────────────────────────── */
const COLORS = {
  grid:        'rgba(255,255,255,0.10)',
  goldenGrid:  'rgba(251,191,36,0.18)',
  oval:        'rgba(99,202,247,0.55)',
  ovalFill:    'rgba(0,0,0,0)',
  midline:     'rgba(251,191,36,0.85)',
  tessellation:'rgba(120,200,255,0.22)',
  leftSide:    'rgba(139,92,246,0.80)',
  rightSide:   'rgba(244,63,94,0.80)',
  landmark:    'rgba(6,182,212,0.90)',
  midlinePt:   'rgba(251,191,36,1)',
  okGlow:      'rgba(16,185,129,0.9)',
};

/* ── MediaPipe FaceMesh tessellation connections (selected subset) ─────── */
// Full list from: https://github.com/google/mediapipe/blob/master/mediapipe/python/solutions/face_mesh_connections.py
const FACE_OVAL_CONNECTIONS = [
  [10,338],[338,297],[297,332],[332,284],[284,251],[251,389],[389,356],
  [356,454],[454,323],[323,361],[361,288],[288,397],[397,365],[365,379],
  [379,378],[378,400],[400,377],[377,152],[152,148],[148,176],[176,149],
  [149,150],[150,136],[136,172],[172,58],[58,132],[132,93],[93,234],
  [234,127],[127,162],[162,21],[21,54],[54,103],[103,67],[67,109],[109,10],
];
const LIPS_CONNECTIONS = [
  [61,146],[146,91],[91,181],[181,84],[84,17],[17,314],[314,405],[405,321],[321,375],[375,291],
  [61,185],[185,40],[40,39],[39,37],[37,0],[0,267],[267,269],[269,270],[270,409],[409,291],
  [78,95],[95,88],[88,178],[178,87],[87,14],[14,317],[317,402],[402,318],[318,324],[324,308],
  [78,191],[191,80],[80,81],[81,82],[82,13],[13,312],[312,311],[311,310],[310,415],[415,308],
];
const LEFT_EYE_CONNECTIONS = [
  [362,382],[382,381],[381,380],[380,374],[374,373],[373,390],[390,249],[249,263],
  [263,466],[466,388],[388,387],[387,386],[386,385],[385,384],[384,398],[398,362],
];
const RIGHT_EYE_CONNECTIONS = [
  [33,7],[7,163],[163,144],[144,145],[145,153],[153,154],[154,155],[155,133],
  [133,173],[173,157],[157,158],[158,159],[159,160],[160,161],[161,246],[246,33],
];

/* ── Utility ─────────────────────────────────────────────────────────────── */
function lmToCanvas(lm, w, h, mirror = true) {
  const x = mirror ? (1 - lm.x) * w : lm.x * w;
  const y = lm.y * h;
  return { x, y };
}

/* ── Component ───────────────────────────────────────────────────────────── */
const CameraOverlay = forwardRef(function CameraOverlay(
  { landmarks, isReady, faceDetected, showGrid, showMidline, showLandmarks, videoEl },
  ref
) {
  const canvasRef    = useRef(null);
  const animFrameRef = useRef(null);

  /* Expose canvas element to parent for frame-capture */
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }), []);

  /* Sync canvas size to video element */
  const syncSize = useCallback(() => {
    const canvas = canvasRef.current;
    const video  = videoEl;
    if (!canvas || !video) return;
    const rect = video.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width  = rect.width;
      canvas.height = rect.height;
    }
  }, [videoEl]);

  useEffect(() => {
    if (!videoEl) return;
    const ro = new ResizeObserver(syncSize);
    ro.observe(videoEl);
    syncSize();
    return () => ro.disconnect();
  }, [videoEl, syncSize]);

  /* Main draw loop */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      const ctx = canvas.getContext('2d');
      const W   = canvas.width;
      const H   = canvas.height;
      if (!W || !H) return;

      ctx.clearRect(0, 0, W, H);

      // ── 1. Golden-ratio / Rule-of-thirds grid ──────────────────────────
      if (showGrid) drawGrid(ctx, W, H);

      // ── 2. Face silhouette oval ────────────────────────────────────────
      drawOval(ctx, W, H, faceDetected);

      if (!landmarks) return;

      // ── 3. Tessellation ───────────────────────────────────────────────
      if (showLandmarks) {
        drawConnections(ctx, landmarks, FACE_OVAL_CONNECTIONS, W, H, COLORS.tessellation, 1);
        drawConnections(ctx, landmarks, LEFT_EYE_CONNECTIONS,  W, H, 'rgba(120,200,255,0.45)', 1.2);
        drawConnections(ctx, landmarks, RIGHT_EYE_CONNECTIONS, W, H, 'rgba(120,200,255,0.45)', 1.2);
        drawConnections(ctx, landmarks, LIPS_CONNECTIONS,      W, H, 'rgba(255,150,150,0.40)', 1);
      }

      // ── 4. Key landmark dots ──────────────────────────────────────────
      if (showLandmarks) drawKeyPoints(ctx, landmarks, W, H);

      // ── 5. Midline + bilateral lines ──────────────────────────────────
      if (showMidline) {
        drawMidline(ctx, landmarks, W, H);
        drawBilateralLines(ctx, landmarks, W, H);
      }
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [landmarks, faceDetected, showGrid, showMidline, showLandmarks]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ mixBlendMode: 'normal' }}
    />
  );
});

export default CameraOverlay;

/* ────────────────────────────────────────────────────────────────────────── */
/* Drawing helpers                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

function drawGrid(ctx, W, H) {
  // Rule of thirds
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth   = 0.8;
  ctx.beginPath();
  [1/3, 2/3].forEach((t) => {
    ctx.moveTo(t * W, 0); ctx.lineTo(t * W, H);
    ctx.moveTo(0, t * H); ctx.lineTo(W, t * H);
  });
  ctx.stroke();

  // Golden ratio verticals (approx. 0.382 / 0.618)
  ctx.strokeStyle = COLORS.goldenGrid;
  ctx.lineWidth   = 1.0;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  [0.382, 0.618].forEach((t) => {
    ctx.moveTo(t * W, 0); ctx.lineTo(t * W, H);
    ctx.moveTo(0, t * H); ctx.lineTo(W, t * H);
  });
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawOval(ctx, W, H, faceDetected) {
  const cx    = W * 0.5;
  const cy    = H * 0.46;
  const rx    = W * 0.28;
  const ry    = H * 0.38;
  const color = faceDetected ? COLORS.okGlow : COLORS.oval;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = faceDetected ? 2.5 : 2;
  ctx.shadowBlur  = faceDetected ? 12 : 0;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // subtle fill darkening outside oval not needed (CSS handles it)
  ctx.restore();
}

function drawConnections(ctx, lm, connections, W, H, color, lw) {
  ctx.strokeStyle = color;
  ctx.lineWidth   = lw;
  ctx.beginPath();
  for (const [a, b] of connections) {
    if (!lm[a] || !lm[b]) continue;
    const pa = lmToCanvas(lm[a], W, H);
    const pb = lmToCanvas(lm[b], W, H);
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
  }
  ctx.stroke();
}

function drawKeyPoints(ctx, lm, W, H) {
  const keys = [
    { idx: LANDMARK_INDICES.glabella,        color: COLORS.midlinePt, r: 3 },
    { idx: LANDMARK_INDICES.nasalTip,         color: COLORS.midlinePt, r: 3 },
    { idx: LANDMARK_INDICES.menton,           color: COLORS.midlinePt, r: 3 },
    { idx: LANDMARK_INDICES.leftPupil,        color: COLORS.leftSide,  r: 4 },
    { idx: LANDMARK_INDICES.rightPupil,       color: COLORS.rightSide, r: 4 },
    { idx: LANDMARK_INDICES.leftExocanthion,  color: COLORS.leftSide,  r: 3 },
    { idx: LANDMARK_INDICES.rightExocanthion, color: COLORS.rightSide, r: 3 },
    { idx: LANDMARK_INDICES.leftAlare,        color: COLORS.leftSide,  r: 3 },
    { idx: LANDMARK_INDICES.rightAlare,       color: COLORS.rightSide, r: 3 },
    { idx: LANDMARK_INDICES.leftCheilion,     color: COLORS.leftSide,  r: 3 },
    { idx: LANDMARK_INDICES.rightCheilion,    color: COLORS.rightSide, r: 3 },
  ];

  for (const k of keys) {
    const pt = lm[k.idx];
    if (!pt) continue;
    const { x, y } = lmToCanvas(pt, W, H);
    ctx.fillStyle   = k.color;
    ctx.shadowBlur  = 6;
    ctx.shadowColor = k.color;
    ctx.beginPath();
    ctx.arc(x, y, k.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur  = 0;
  }
}

function drawMidline(ctx, lm, W, H) {
  const anchors = [
    lm[LANDMARK_INDICES.glabella],
    lm[LANDMARK_INDICES.nasalBridge],
    lm[LANDMARK_INDICES.nasalTip],
    lm[LANDMARK_INDICES.subnasal],
    lm[LANDMARK_INDICES.menton],
  ].filter(Boolean).map((p) => lmToCanvas(p, W, H));

  if (anchors.length < 2) return;

  // Draw dotted line connecting midline points
  ctx.strokeStyle  = COLORS.midline;
  ctx.lineWidth    = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.shadowBlur   = 8;
  ctx.shadowColor  = COLORS.midline;
  ctx.beginPath();
  ctx.moveTo(anchors[0].x, anchors[0].y);
  for (let i = 1; i < anchors.length; i++) {
    ctx.lineTo(anchors[i].x, anchors[i].y);
  }
  // Extend to top and bottom of frame
  const top    = { x: anchors[0].x,                   y: 0   };
  const bottom = { x: anchors[anchors.length - 1].x,   y: H   };
  ctx.moveTo(top.x, top.y);     ctx.lineTo(anchors[0].x, anchors[0].y);
  ctx.moveTo(bottom.x, bottom.y); ctx.lineTo(anchors[anchors.length-1].x, anchors[anchors.length-1].y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
}

function drawBilateralLines(ctx, lm, W, H) {
  for (const pair of BILATERAL_PAIRS.slice(0, 5)) {  // top 5 pairs only to avoid clutter
    const idxL = LANDMARK_INDICES[pair.left];
    const idxR = LANDMARK_INDICES[pair.right];
    if (!lm[idxL] || !lm[idxR]) continue;
    const pL = lmToCanvas(lm[idxL], W, H);
    const pR = lmToCanvas(lm[idxR], W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth   = 0.8;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(pL.x, pL.y); ctx.lineTo(pR.x, pR.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
