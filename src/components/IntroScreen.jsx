/**
 * IntroScreen.jsx
 * Welcome / onboarding screen with scientific context.
 */

import React from 'react';

const FEATURES = [
  {
    icon: '🔬',
    title: 'MediaPipe Face Mesh',
    desc:  '468+ facial landmarks mapped in real time for sub-millimetre precision.',
  },
  {
    icon: '📐',
    title: 'Sagittal-Plane Midline',
    desc:  'Best-fit midline through Glabella → Nasal Bridge → Menton via principal-axis regression.',
  },
  {
    icon: '📊',
    title: 'Asymmetry Index (AI)',
    desc:  'AI = |d(Lₗ,M) − d(Lᵣ,M)| / mean × 100 % for each bilateral landmark pair.',
  },
  {
    icon: '🌡️',
    title: 'Asymmetry Heatmap',
    desc:  'Per-region colour coding and split-face (Left-Left vs Right-Right) visualisation.',
  },
  {
    icon: '📱',
    title: 'Standardised Capture',
    desc:  'Real-time Roll / Yaw / Pitch guard with lighting and distance checks.',
  },
];

export default function IntroScreen({ onStart }) {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-950 flex flex-col overflow-y-auto">

      {/* Hero */}
      <div className="relative flex flex-col items-center justify-center px-6 pt-16 pb-10 text-center">
        {/* Glow orb */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2
          w-72 h-72 rounded-full bg-cyan-600/20 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          {/* App icon ring */}
          <div className="mx-auto mb-6 w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500 via-violet-500 to-rose-500
            flex items-center justify-center shadow-xl shadow-cyan-500/20">
            <svg viewBox="0 0 40 40" className="w-14 h-14" fill="none">
              {/* Face outline */}
              <ellipse cx="20" cy="18" rx="11" ry="14" stroke="white" strokeWidth="1.8" />
              {/* Eyes */}
              <circle cx="15" cy="14" r="2" fill="white" opacity=".9" />
              <circle cx="25" cy="14" r="2" fill="white" opacity=".9" />
              {/* Midline */}
              <line x1="20" y1="4" x2="20" y2="36" stroke="#facc15" strokeWidth="1.2" strokeDasharray="2 2" />
              {/* Bilateral lines */}
              <line x1="15" y1="14" x2="25" y2="14" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
              <line x1="14" y1="22" x2="26" y2="22" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-white tracking-tight">FaceAnalytics</h1>
          <p className="mt-2 text-cyan-400 font-medium text-sm uppercase tracking-widest">
            Facial Symmetry Analysis
          </p>
          <p className="mt-4 text-white/60 text-sm max-w-xs leading-relaxed">
            A scientific, privacy-first tool using on-device AI to quantify bilateral
            facial asymmetry. All processing happens locally — no photos are uploaded.
          </p>
        </div>
      </div>

      {/* Feature list */}
      <div className="px-5 pb-6 space-y-3 max-w-md mx-auto w-full">
        {FEATURES.map((f, i) => (
          <div key={i}
            className="flex gap-4 bg-white/5 rounded-2xl px-4 py-3 border border-white/8">
            <span className="text-2xl leading-none mt-0.5">{f.icon}</span>
            <div>
              <p className="text-white text-sm font-semibold">{f.title}</p>
              <p className="text-white/50 text-xs leading-relaxed mt-0.5">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="px-6 pb-4 max-w-md mx-auto w-full">
        <p className="text-white/30 text-xs text-center leading-relaxed">
          This app is for educational and research purposes only.
          Results do not constitute medical advice.
        </p>
      </div>

      {/* CTA */}
      <div className="sticky bottom-0 bg-slate-950/90 backdrop-blur-sm px-6 pb-safe-bottom pt-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}>
        <button
          onClick={onStart}
          className="w-full max-w-md mx-auto block btn-primary text-base py-4 rounded-2xl font-semibold
            bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400
            transition-all shadow-lg shadow-cyan-500/25"
        >
          Start Analysis
        </button>
      </div>
    </div>
  );
}
