/**
 * AsymmetryGauge.jsx
 * SVG arc gauge showing the global asymmetry score.
 */

import React from 'react';

const RADIUS  = 70;
const STROKE  = 10;
const C       = 90;   // viewBox center
const FULL    = 2 * Math.PI * RADIUS;
// Arc sweep: 240 degrees (from 150° to 390°)
const SWEEP   = (240 / 360) * FULL;

function scoreToOffset(score) {
  // 0 = fully filled (most symmetric), 30+ = empty
  const clamped = Math.min(score, 30);
  const filled  = 1 - clamped / 30;
  return FULL - filled * SWEEP;
}

function scoreToColor(score) {
  if (score < 3)  return '#10b981';
  if (score < 6)  return '#22c55e';
  if (score < 10) return '#84cc16';
  if (score < 15) return '#f59e0b';
  if (score < 22) return '#f97316';
  return '#f43f5e';
}

export default function AsymmetryGauge({ score, grade }) {
  const color  = scoreToColor(score);
  const offset = scoreToOffset(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 180 160" className="w-48 h-44 drop-shadow-lg">
        {/* Background arc */}
        <circle
          cx={C} cy={C} r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={STROKE}
          strokeDasharray={`${SWEEP} ${FULL - SWEEP}`}
          strokeDashoffset={-(FULL * (60 / 360))}   // start at 150°
          strokeLinecap="round"
          transform="rotate(150, 90, 90)"
        />
        {/* Colour arc */}
        <circle
          cx={C} cy={C} r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeDasharray={`${SWEEP - offset} ${FULL - (SWEEP - offset)}`}
          strokeDashoffset={-(FULL * (60 / 360))}
          strokeLinecap="round"
          transform="rotate(150, 90, 90)"
          style={{ transition: 'stroke-dasharray 1s ease, stroke 0.5s ease', filter: `drop-shadow(0 0 8px ${color}88)` }}
        />
        {/* Score text */}
        <text x={C} y={C - 6} textAnchor="middle" fill={color}
          fontSize="28" fontWeight="700" fontFamily="JetBrains Mono, monospace">
          {score.toFixed(1)}
        </text>
        <text x={C} y={C + 14} textAnchor="middle" fill="rgba(255,255,255,0.5)"
          fontSize="10" fontFamily="Inter, sans-serif" letterSpacing="1">
          AI SCORE %
        </text>
        {/* Grade badge */}
        <text x={C} y={C + 44} textAnchor="middle" fill={color}
          fontSize="22" fontWeight="700" fontFamily="JetBrains Mono, monospace">
          {grade.tier}
        </text>
      </svg>

      <div className="text-center">
        <p className="font-semibold text-base" style={{ color }}>{grade.label}</p>
        <p className="text-white/40 text-xs mt-0.5">Weighted Asymmetry Index</p>
      </div>
    </div>
  );
}
