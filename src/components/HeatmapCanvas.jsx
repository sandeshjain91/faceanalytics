/**
 * HeatmapCanvas.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the captured photo with:
 *   – Midline overlay
 *   – Per-landmark AI heatmap dots (green→red scale)
 *   – Bilateral distance annotations
 *   – Interpupillary + intercommissural angle lines
 *
 * Also renders the "Split-Face" canvases (Left-Left mirrored, Right-Right mirrored).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useRef, useEffect, useState } from 'react';
import { BILATERAL_PAIRS, LANDMARK_INDICES } from '../utils/asymmetryCalculator.js';

/* AI % → colour (green = 0, yellow = 10, red = 20+) */
function aiToColor(aiPct) {
  const t = Math.min(aiPct / 20, 1);
  if (t < 0.5) {
    const r = Math.round(16  + (251 - 16)  * (t * 2));
    const g = Math.round(185 + (191 - 185) * (t * 2));
    const b = Math.round(129 - (129)       * (t * 2));
    return `rgb(${r},${g},${b})`;
  }
  const t2 = (t - 0.5) * 2;
  const r = Math.round(251 + (244 - 251) * t2);
  const g = Math.round(191 - (191)       * t2);
  const b = Math.round(0);
  return `rgb(${r},${g},${b})`;
}

function lmPx(lm, W, H, mirror = false) {
  const x = mirror ? (1 - lm.x) * W : lm.x * W;
  const y = lm.y * H;
  return { x, y };
}

/* ── Main annotated canvas ─────────────────────────────────────────────── */
export function HeatmapCanvas({ photoURL, photoW, photoH, report }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !photoURL || !report) return;

    const ctx = canvas.getContext('2d');
    const W   = canvas.width  = photoW;
    const H   = canvas.height = photoH;

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, W, H);
      drawAnnotations(ctx, W, H, report);
    };
    img.src = photoURL;
  }, [photoURL, photoW, photoH, report]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-auto rounded-2xl shadow-xl object-contain"
      style={{ maxHeight: '55vh' }}
    />
  );
}

function drawAnnotations(ctx, W, H, report) {
  const { midline, pairs, keyPoints, ipAngle, icAngle } = report;
  if (!keyPoints) return;

  // ── Midline ─────────────────────────────────────────────────────────────
  const mA  = { x: (1 - midline.Ax) * W, y: midline.Ay * H };
  // Direction vector (mirror x since photo is mirrored)
  const mDx = -midline.Dx;
  const mDy =  midline.Dy;
  const t1  = Math.min(mA.y / Math.abs(mDy || 0.0001), 800);
  const t2  = Math.min((H - mA.y) / Math.abs(mDy || 0.0001), 800);

  ctx.strokeStyle = 'rgba(251,191,36,0.9)';
  ctx.lineWidth   = 2;
  ctx.setLineDash([8, 6]);
  ctx.shadowBlur  = 10;
  ctx.shadowColor = '#facc15';
  ctx.beginPath();
  ctx.moveTo(mA.x - mDx * t1, mA.y - mDy * t1);
  ctx.lineTo(mA.x + mDx * t2, mA.y + mDy * t2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;

  // ── Bilateral heatmap dots & lines ──────────────────────────────────────
  const validPairs = pairs.filter((p) => p.valid);

  for (const pair of validPairs) {
    const idxL = LANDMARK_INDICES[pair.left];
    const idxR = LANDMARK_INDICES[pair.right];
    const Ll   = report.keyPoints[pair.left];
    const Lr   = report.keyPoints[pair.right];
    if (!Ll || !Lr) continue;

    const pL = { x: (1 - Ll.x) * W, y: Ll.y * H };
    const pR = { x: (1 - Lr.x) * W, y: Lr.y * H };
    const c  = aiToColor(pair.aiPct);

    // Connection line
    ctx.strokeStyle = `${c}60`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(pL.x, pL.y);
    ctx.lineTo(pR.x, pR.y);
    ctx.stroke();

    // Dots
    for (const pt of [pL, pR]) {
      ctx.fillStyle   = c;
      ctx.shadowBlur  = 10;
      ctx.shadowColor = c;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // AI label (only if notable)
    if (pair.aiPct > 3) {
      const mx = (pL.x + pR.x) / 2;
      const my = (pL.y + pR.y) / 2 - 10;
      ctx.fillStyle    = c;
      ctx.font         = `bold ${W > 600 ? 11 : 9}px JetBrains Mono, monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${pair.aiPct.toFixed(1)}%`, mx, my);
    }
  }
}

/* ── Split-Face canvases ───────────────────────────────────────────────── */
export function SplitFaceCanvases({ photoURL, photoW, photoH, midlineX }) {
  const leftRef  = useRef(null);
  const rightRef = useRef(null);

  useEffect(() => {
    if (!photoURL || !photoW || !photoH) return;

    const img = new Image();
    img.onload = () => {
      drawSplitFace(leftRef.current,  img, photoW, photoH, midlineX, 'left');
      drawSplitFace(rightRef.current, img, photoW, photoH, midlineX, 'right');
    };
    img.src = photoURL;
  }, [photoURL, photoW, photoH, midlineX]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="text-center">
        <p className="text-violet-400 text-xs font-medium mb-2 uppercase tracking-wide">Left × 2</p>
        <canvas ref={leftRef}  className="w-full rounded-xl shadow-lg object-contain" />
      </div>
      <div className="text-center">
        <p className="text-rose-400 text-xs font-medium mb-2 uppercase tracking-wide">Right × 2</p>
        <canvas ref={rightRef} className="w-full rounded-xl shadow-lg object-contain" />
      </div>
    </div>
  );
}

function drawSplitFace(canvas, img, W, H, midlineNorm, side) {
  if (!canvas) return;
  // Midline in actual pixel coords (photo is already mirrored in capture)
  const midPx = (1 - midlineNorm) * W;

  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  if (side === 'left') {
    // Draw left half, then mirror it on right side
    ctx.drawImage(img, 0, 0, W, H);
    // Mask right half
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.rect(0, 0, midPx, H);
    ctx.fill();
    ctx.restore();
    // Mirror left half onto right
    ctx.save();
    ctx.translate(2 * midPx, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, W, H);
    // Mask left half of mirrored image
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.rect(midPx, 0, W - midPx, H);   // reveal only right portion = mirrored left
    ctx.fill();
    ctx.restore();
  } else {
    // Draw right half + its mirror
    ctx.drawImage(img, 0, 0, W, H);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.rect(midPx, 0, W - midPx, H);
    ctx.fill();
    ctx.restore();
    // Mirror right onto left
    ctx.save();
    ctx.translate(2 * midPx, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.rect(0, 0, midPx, H);
    ctx.fill();
    ctx.restore();
  }
}
