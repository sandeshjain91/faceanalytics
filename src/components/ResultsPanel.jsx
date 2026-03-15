/**
 * ResultsPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full results screen:
 *   1. Photo with heatmap annotations
 *   2. Global score gauge
 *   3. Per-pair asymmetry bar chart
 *   4. Horizontal alignment metrics
 *   5. Head pose summary
 *   6. Lighting report
 *   7. Split-face visualisation
 *   8. Scientific methodology note
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from 'react';
import AsymmetryGauge from './AsymmetryGauge.jsx';
import { HeatmapCanvas, SplitFaceCanvases } from './HeatmapCanvas.jsx';

const TAB_LABELS = ['Heatmap', 'Metrics', 'Split Face', 'Science'];

export default function ResultsPanel({ data, onRetake, onHome }) {
  const [tab, setTab] = useState(0);

  if (!data) return null;

  const {
    globalScore, grade, pairs, midline,
    ipAngle, icAngle,
    headPose, lighting, distCheck,
    photoURL, photoW, photoH,
  } = data;

  const midlineXNorm = midline?.Ax ?? 0.5;
  const validPairs   = (pairs || []).filter((p) => p.valid);

  return (
    <div className="flex flex-col min-h-screen min-h-[100dvh] bg-slate-950 text-white">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-safe-top pb-3 bg-slate-900/80 backdrop-blur-sm border-b border-white/8"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
        <button onClick={onHome}   className="btn-icon text-sm text-white/60 hover:text-white">← Home</button>
        <h1 className="text-base font-semibold tracking-wide">Analysis Results</h1>
        <button onClick={onRetake} className="text-cyan-400 text-sm font-medium">Retake</button>
      </div>

      {/* ── Score summary row ────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-1 px-6 pt-6 pb-4 bg-slate-900/40">
        <AsymmetryGauge score={globalScore} grade={grade} />

        {/* Quick metrics row */}
        <div className="flex gap-6 mt-2 text-center">
          <MetricPill label="Roll"  value={`${headPose.roll > 0 ? '+' : ''}${headPose.roll}°`}  ok={Math.abs(headPose.roll)  < 8}  />
          <MetricPill label="Yaw"   value={`${headPose.yaw  > 0 ? '+' : ''}${headPose.yaw}°`}   ok={Math.abs(headPose.yaw)   < 12} />
          <MetricPill label="Pitch" value={`${headPose.pitch > 0 ? '+' : ''}${headPose.pitch}°`} ok={Math.abs(headPose.pitch) < 10} />
          <MetricPill label="IP°"   value={`${ipAngle > 0 ? '+' : ''}${ipAngle}°`}               ok={Math.abs(ipAngle) < 3}  />
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="flex bg-slate-900/60 border-b border-white/8">
        {TAB_LABELS.map((label, i) => (
          <button
            key={label}
            onClick={() => setTab(i)}
            className={`flex-1 py-3 text-xs font-medium uppercase tracking-wide transition-colors
              ${tab === i
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-white/40 hover:text-white/70'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── TAB 0: Heatmap ─────────────────────────────────────────────── */}
        {tab === 0 && (
          <div className="p-4 space-y-4 animate-fade-in">
            <p className="text-white/50 text-xs text-center">
              Dots coloured by AI% · <span className="text-emerald-400">■</span> low ·
              <span className="text-amber-400 ml-1">■</span> medium ·
              <span className="text-rose-400 ml-1">■</span> high asymmetry
            </p>
            {photoURL && (
              <HeatmapCanvas
                photoURL={photoURL}
                photoW={photoW}
                photoH={photoH}
                report={data}
              />
            )}
            <LightingReport lighting={lighting} />
          </div>
        )}

        {/* ── TAB 1: Metrics ─────────────────────────────────────────────── */}
        {tab === 1 && (
          <div className="p-4 space-y-4 animate-fade-in">
            <SectionHeader title="Bilateral Asymmetry Index" subtitle="AI = |dₗ − dᵣ| / mean × 100 %" />
            {validPairs.map((pair) => (
              <PairRow key={pair.id} pair={pair} />
            ))}

            <SectionHeader title="Horizontal Alignment" subtitle="Deviation from horizontal (°)" />
            <div className="grid grid-cols-2 gap-3">
              <AlignCard label="Interpupillary Line" angle={ipAngle} thresh={3} />
              <AlignCard label="Intercommissural Line" angle={icAngle} thresh={3} />
            </div>

            <SectionHeader title="Head Pose at Capture" />
            <div className="grid grid-cols-3 gap-3">
              <PoseCard label="Roll"  value={headPose.roll}  thresh={8}  unit="°" />
              <PoseCard label="Yaw"   value={headPose.yaw}   thresh={12} unit="°" />
              <PoseCard label="Pitch" value={headPose.pitch} thresh={10} unit="°" />
            </div>
          </div>
        )}

        {/* ── TAB 2: Split Face ──────────────────────────────────────────── */}
        {tab === 2 && (
          <div className="p-4 animate-fade-in space-y-4">
            <p className="text-white/50 text-xs text-center leading-relaxed">
              Left-Left and Right-Right composites reveal how your face would look
              if both sides were perfectly mirrored.
            </p>
            {photoURL && (
              <SplitFaceCanvases
                photoURL={photoURL}
                photoW={photoW}
                photoH={photoH}
                midlineX={midlineXNorm}
              />
            )}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <p className="text-amber-400 text-xs font-semibold mb-1">Note on Split-Face Analysis</p>
              <p className="text-white/60 text-xs leading-relaxed">
                The split-face technique, introduced in studies of facial attractiveness,
                composites each half of the face with its own mirror image.
                Differences between the two composites visually represent the degree
                of bilateral facial asymmetry.
              </p>
            </div>
          </div>
        )}

        {/* ── TAB 3: Science ─────────────────────────────────────────────── */}
        {tab === 3 && (
          <div className="p-4 animate-fade-in space-y-4">
            <ScienceCard
              title="Midline (Sagittal Plane)"
              formula="M = argmin Σ d(Pᵢ, L)²"
              body="The facial midline M is estimated as the principal axis through Glabella (168), Nasal-Bridge (6), Nasal-Tip (4), Subnasale (2), and Menton (152) via least-squares principal-component regression."
            />
            <ScienceCard
              title="Point-to-Line Distance"
              formula="d(L, M) = ||(L−A) − [(L−A)·d̂]d̂||"
              body="For each landmark L, its perpendicular distance to the midline M (defined by anchor A and unit direction d̂) is computed using the vector rejection formula."
            />
            <ScienceCard
              title="Asymmetry Index (AI)"
              formula="AI = |d(Lₗ,M) − d(Lᵣ,M)| / [(dₗ + dᵣ)/2] × 100 %"
              body="The AI expresses the absolute bilateral distance difference as a percentage of the mean bilateral distance, following the method of Farkas & Cheung (1981) and Zaidel et al. (1995)."
            />
            <ScienceCard
              title="Global Asymmetry Score"
              formula="GAS = Σ(wᵢ × AIᵢ) / Σwᵢ"
              body="A weighted mean of per-pair AIs. Pairs closer to the optical axis (pupils, alare) are weighted more heavily (w=2.0–1.8) than peripheral pairs (w=1.0)."
            />
            <ScienceCard
              title="Head Pose Estimation"
              formula="Roll = −arctan2(Δy_pupils, Δx_pupils)"
              body="Roll is the signed angle of the interpupillary line. Yaw is approximated by the ratio of left-face-width to right-face-width relative to the nasal midpoint. Pitch uses the vertical position of the nasal tip relative to the facial mid-height."
            />
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <p className="text-white/70 text-xs leading-relaxed">
                <span className="text-white font-semibold block mb-1">References</span>
                Farkas LG, Cheung G. (1981). Facial asymmetry in healthy North American Caucasians. <em>Angle Orthod</em>.<br />
                Zaidel DW et al. (1995). Appearance of symmetry, beauty, and health in human faces. <em>Brain Cogn</em>.<br />
                Penton-Voak IS et al. (2001). Symmetry, sexual dimorphism in facial proportions. <em>Proc R Soc B</em>.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Bottom action bar */}
      <div className="bg-slate-900/90 backdrop-blur-sm border-t border-white/8 px-5 py-3 flex gap-3"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
        <button onClick={onRetake} className="flex-1 btn-primary bg-cyan-500 hover:bg-cyan-400 py-3 rounded-xl font-semibold">
          New Analysis
        </button>
        <button onClick={() => handleShare(data)} className="flex-none btn-icon bg-white/10 hover:bg-white/20 px-4 py-3 rounded-xl">
          <ShareIcon />
        </button>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function MetricPill({ label, value, ok }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-sm font-mono font-semibold ${ok ? 'text-emerald-400' : 'text-amber-400'}`}>{value}</span>
      <span className="text-white/40 text-xs">{label}</span>
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="pt-2">
      <h3 className="text-white font-semibold text-sm">{title}</h3>
      {subtitle && <p className="text-white/40 text-xs mt-0.5 font-mono">{subtitle}</p>}
    </div>
  );
}

function PairRow({ pair }) {
  const barWidth = Math.min(pair.aiPct * 3, 100);
  const color    = pair.aiPct < 5
    ? '#10b981' : pair.aiPct < 10
    ? '#f59e0b' : '#f43f5e';

  return (
    <div className="bg-white/5 rounded-xl px-4 py-3 border border-white/8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/80 text-xs font-medium">{pair.label}</span>
        <span className="font-mono text-sm font-semibold" style={{ color }}>
          {pair.aiPct.toFixed(1)}%
        </span>
      </div>
      {/* Bar */}
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${barWidth}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}88` }}
        />
      </div>
      {/* Left / Right distances */}
      <div className="flex justify-between mt-1.5">
        <span className="text-violet-400/70 text-xs font-mono">L: {pair.dL}</span>
        <span className="text-rose-400/70 text-xs font-mono">R: {pair.dR}</span>
      </div>
    </div>
  );
}

function AlignCard({ label, angle, thresh }) {
  const ok    = Math.abs(angle) < thresh;
  const color = ok ? '#10b981' : '#f59e0b';
  return (
    <div className="bg-white/5 rounded-xl px-4 py-4 border border-white/8 text-center">
      <p className="font-mono text-lg font-bold" style={{ color }}>
        {angle > 0 ? '+' : ''}{angle}°
      </p>
      <p className="text-white/50 text-xs mt-1 leading-tight">{label}</p>
      <p className="text-xs mt-1" style={{ color }}>{ok ? 'Aligned' : 'Slight tilt'}</p>
    </div>
  );
}

function PoseCard({ label, value, thresh, unit }) {
  const ok    = Math.abs(value) < thresh;
  const color = ok ? '#10b981' : '#f59e0b';
  return (
    <div className="bg-white/5 rounded-xl px-3 py-4 border border-white/8 text-center">
      <p className="font-mono text-lg font-bold" style={{ color }}>
        {value > 0 ? '+' : ''}{value}{unit}
      </p>
      <p className="text-white/50 text-xs mt-1">{label}</p>
    </div>
  );
}

function LightingReport({ lighting }) {
  if (!lighting) return null;
  return (
    <div className={`rounded-xl px-4 py-3 border flex items-start gap-3
      ${lighting.ok
        ? 'bg-emerald-500/10 border-emerald-500/30'
        : 'bg-amber-500/10 border-amber-500/30'}`}>
      <span className="text-xl">{lighting.ok ? '💡' : '⚠️'}</span>
      <div>
        <p className={`text-xs font-semibold ${lighting.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
          {lighting.ok ? 'Even Lighting' : 'Uneven Lighting Detected'}
        </p>
        <p className="text-white/50 text-xs mt-0.5">
          Left luminance: {lighting.leftLum} · Right: {lighting.rightLum} · Δ {lighting.diff}
        </p>
      </div>
    </div>
  );
}

function ScienceCard({ title, formula, body }) {
  return (
    <div className="bg-white/5 rounded-2xl px-4 py-4 border border-white/10 space-y-2">
      <p className="text-cyan-400 text-xs font-semibold uppercase tracking-wide">{title}</p>
      <p className="font-mono text-amber-300/90 text-xs bg-black/30 rounded-lg px-3 py-2">{formula}</p>
      <p className="text-white/60 text-xs leading-relaxed">{body}</p>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-white/70">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  );
}

async function handleShare(data) {
  const text = `FaceAnalytics Result\n\n` +
    `Global Asymmetry Score: ${data.globalScore.toFixed(1)}% — ${data.grade.label}\n` +
    `Roll: ${data.headPose.roll}° · Yaw: ${data.headPose.yaw}° · Pitch: ${data.headPose.pitch}°\n` +
    `Interpupillary angle: ${data.ipAngle}°\n`;

  if (navigator.share) {
    try {
      await navigator.share({ title: 'FaceAnalytics', text });
    } catch (_) {}
  } else {
    await navigator.clipboard.writeText(text);
    alert('Results copied to clipboard!');
  }
}
