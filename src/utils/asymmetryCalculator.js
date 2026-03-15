/**
 * asymmetryCalculator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Scientific facial-asymmetry engine.
 *
 * Mathematical model
 * ──────────────────
 * 1.  Midline M:  Best-fit vertical line through glabella (G), nasal-bridge
 *     mid (N), nasal-tip (T), and menton (Me).  We use the parametric line
 *     form  P(t) = A + t·d̂  where d̂ is the unit direction vector.
 *
 * 2.  Point-to-line distance:
 *         d(L, M) = ||(L − A) − [(L − A)·d̂]·d̂||
 *
 * 3.  Asymmetry Index (AI) for a bilateral landmark pair (Lₗ, Lᵣ):
 *         AI = |d(Lₗ, M) − d(Lᵣ, M)|  / [(d(Lₗ, M) + d(Lᵣ, M)) / 2] × 100 %
 *
 * 4.  Global Asymmetry Score = weighted mean of all AIs.
 *
 * 5.  Horizontal Alignment:  angle of interpupillary line and
 *     intercommissural line relative to the horizon (canvas x-axis).
 *
 * 6.  Head-pose estimation from landmark geometry:
 *     - Roll  : angle of inter-pupil line.
 *     - Yaw   : ratio of left-face-width to right-face-width.
 *     - Pitch : vertical displacement of nose-tip relative to mid-face centre.
 *
 * All coordinates are in normalised [0,1] space (as provided by MediaPipe).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ── MediaPipe FaceMesh 468-point landmark indices ───────────────────────── */
export const LANDMARK_INDICES = {
  // ── Midline anchors ──────────────────────────────────────────────────────
  glabella:      168,   // Glabella (brow centre / bridge of nose)
  nasalBridge:   6,     // Nasal-bridge (rhinion)
  nasalTip:      4,     // Nasal tip (pronasale)
  subnasal:      2,     // Subnasale
  menton:        152,   // Menton / chin tip

  // ── Bilateral landmarks ──────────────────────────────────────────────────
  // Eyes
  leftExocanthion:  263,  rightExocanthion:  33,
  leftEndocanthion: 362,  rightEndocanthion: 133,

  // Pupils (approximated as eye-centre mid-points)
  leftPupil:  473,  rightPupil:  468,   // iris centre landmarks (requires REFINE_LANDMARKS)

  // Eyebrows
  leftBrowOuter:  300,  rightBrowOuter: 70,
  leftBrowInner:  285,  rightBrowInner: 55,

  // Nose
  leftAlare:  358,  rightAlare:  129,   // alar base

  // Lips / mouth
  leftCheilion:  61,   rightCheilion:  291,  // mouth corners

  // Jaw / face width
  leftJaw:  234,  rightJaw:  454,
  leftCheek: 116, rightCheek: 345,
};

/* ── Landmark pair definitions for bilateral analysis ────────────────────── */
export const BILATERAL_PAIRS = [
  { id: 'exocanthion',  label: 'Outer Eye (Exocanthion)',  left: 'leftExocanthion',  right: 'rightExocanthion',  weight: 1.5 },
  { id: 'endocanthion', label: 'Inner Eye (Endocanthion)', left: 'leftEndocanthion', right: 'rightEndocanthion', weight: 1.5 },
  { id: 'pupil',        label: 'Pupil Centre',             left: 'leftPupil',        right: 'rightPupil',        weight: 2.0 },
  { id: 'browOuter',    label: 'Outer Brow',               left: 'leftBrowOuter',    right: 'rightBrowOuter',    weight: 1.0 },
  { id: 'browInner',    label: 'Inner Brow',               left: 'leftBrowInner',    right: 'rightBrowInner',    weight: 1.0 },
  { id: 'alare',        label: 'Nostril Wing (Alare)',     left: 'leftAlare',        right: 'rightAlare',        weight: 1.8 },
  { id: 'cheilion',     label: 'Mouth Corner (Cheilion)',  left: 'leftCheilion',     right: 'rightCheilion',     weight: 1.8 },
  { id: 'jaw',          label: 'Jaw Width',                left: 'leftJaw',          right: 'rightJaw',          weight: 1.2 },
  { id: 'cheek',        label: 'Cheek Width',              left: 'leftCheek',        right: 'rightCheek',        weight: 1.0 },
];

/* ── Vector helpers ──────────────────────────────────────────────────────── */
const sub   = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const dot   = (a, b) => a.x * b.x + a.y * b.y;
const len   = (v)    => Math.sqrt(v.x * v.x + v.y * v.y);
const norm  = (v)    => { const l = len(v); return { x: v.x / l, y: v.y / l }; };
const scale = (v, s) => ({ x: v.x * s, y: v.y * s });

/**
 * pointToLineDistance(P, A, d̂)
 * Distance from point P to the infinite line passing through A with
 * unit-direction vector d̂.
 */
function pointToLineDistance(P, A, dHat) {
  const ap   = sub(P, A);
  const proj = scale(dHat, dot(ap, dHat));
  const perp = sub(ap, proj);
  return len(perp);
}

/**
 * fitMidline(landmarks)
 * Returns { A, dHat } – the best-fit vertical midline through the
 * glabella, nasal-bridge, nasal-tip, subnasal, and menton.
 * Uses least-squares line fit (Deming regression variant).
 */
function fitMidline(lm) {
  const anchors = [
    lm[LANDMARK_INDICES.glabella],
    lm[LANDMARK_INDICES.nasalBridge],
    lm[LANDMARK_INDICES.nasalTip],
    lm[LANDMARK_INDICES.subnasal],
    lm[LANDMARK_INDICES.menton],
  ].filter(Boolean);

  const n  = anchors.length;
  const mx = anchors.reduce((s, p) => s + p.x, 0) / n;
  const my = anchors.reduce((s, p) => s + p.y, 0) / n;

  let Sxy = 0, Sxx = 0, Syy = 0;
  for (const p of anchors) {
    const dx = p.x - mx, dy = p.y - my;
    Sxx += dx * dx;
    Syy += dy * dy;
    Sxy += dx * dy;
  }

  // Principal-axis direction via eigenvalue of covariance matrix
  let dHat;
  if (Math.abs(Sxx - Syy) < 1e-10 && Math.abs(Sxy) < 1e-10) {
    dHat = { x: 0, y: 1 };                      // perfectly vertical
  } else {
    const theta = 0.5 * Math.atan2(2 * Sxy, Sxx - Syy);
    dHat = { x: Math.sin(theta), y: Math.cos(theta) };  // near-vertical axis
  }

  return { A: { x: mx, y: my }, dHat };
}

/**
 * angleDeg(a, b)
 * Signed angle in degrees of vector b→a relative to the positive x-axis.
 */
function angleDeg(a, b) {
  return Math.atan2(a.y - b.y, a.x - b.x) * (180 / Math.PI);
}

/* ── Head-pose estimation ────────────────────────────────────────────────── */
/**
 * estimateHeadPose(lm)
 * Returns { roll, yaw, pitch } in degrees (approximate).
 *
 * Roll  – tilt left/right  : angle of the interpupillary line
 * Yaw   – turn left/right  : asymmetry of face half-widths
 * Pitch – nod up/down      : normalised vertical position of nose tip
 */
export function estimateHeadPose(lm) {
  const leftEye  = lm[LANDMARK_INDICES.leftPupil]  || lm[LANDMARK_INDICES.leftExocanthion];
  const rightEye = lm[LANDMARK_INDICES.rightPupil] || lm[LANDMARK_INDICES.rightExocanthion];
  const nose     = lm[LANDMARK_INDICES.nasalTip];
  const chin     = lm[LANDMARK_INDICES.menton];
  const brow     = lm[LANDMARK_INDICES.glabella];
  const leftJaw  = lm[LANDMARK_INDICES.leftJaw];
  const rightJaw = lm[LANDMARK_INDICES.rightJaw];

  // ── Roll ────────────────────────────────────────────────────────────────
  const roll = leftEye && rightEye
    ? -angleDeg(leftEye, rightEye)   // negative because y-axis is flipped in canvas
    : 0;

  // ── Yaw (left/right turn) ────────────────────────────────────────────────
  // Compare left half-width vs right half-width using midline x
  let yaw = 0;
  if (nose && leftJaw && rightJaw) {
    const midX    = nose.x;
    const leftW   = midX - leftJaw.x;   // positive = left side visible
    const rightW  = rightJaw.x - midX;  // positive = right side visible
    const total   = leftW + rightW;
    if (total > 0.01) {
      yaw = ((rightW - leftW) / total) * 60;  // scale to ≈ degrees
    }
  }

  // ── Pitch (up/down nod) ──────────────────────────────────────────────────
  let pitch = 0;
  if (nose && brow && chin) {
    const faceH   = chin.y - brow.y;
    if (faceH > 0.01) {
      const midY   = (brow.y + chin.y) / 2;
      pitch = ((nose.y - midY) / faceH) * 60;
    }
  }

  return {
    roll:  parseFloat(roll.toFixed(2)),
    yaw:   parseFloat(yaw.toFixed(2)),
    pitch: parseFloat(pitch.toFixed(2)),
  };
}

/* ── Lighting check ─────────────────────────────────────────────────────── */
/**
 * analyseLighting(imageData, lm, canvasW, canvasH)
 * Splits the face region into left and right halves; computes mean
 * luminance for each side.  Returns { ok, leftLum, rightLum, diff }.
 */
export function analyseLighting(imageData, lm, canvasW, canvasH) {
  if (!imageData || !lm) return { ok: true, leftLum: 128, rightLum: 128, diff: 0 };

  const nose = lm[LANDMARK_INDICES.nasalTip];
  if (!nose) return { ok: true, leftLum: 128, rightLum: 128, diff: 0 };

  const midX = Math.floor(nose.x * canvasW);
  const data  = imageData.data;
  const w     = imageData.width;

  let leftSum = 0, leftCount = 0, rightSum = 0, rightCount = 0;

  for (let y = 0; y < imageData.height; y++) {
    for (let x = 0; x < imageData.width; x++) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (x < midX) { leftSum  += lum; leftCount++;  }
      else          { rightSum += lum; rightCount++; }
    }
  }

  const leftLum  = leftCount  ? leftSum  / leftCount  : 128;
  const rightLum = rightCount ? rightSum / rightCount : 128;
  const diff     = Math.abs(leftLum - rightLum);

  return {
    ok:       diff < 30,        // flag if >30 luminance unit difference
    leftLum:  Math.round(leftLum),
    rightLum: Math.round(rightLum),
    diff:     Math.round(diff),
  };
}

/* ── Face-size / distance check ─────────────────────────────────────────── */
/**
 * checkFaceDistance(lm, frameW, frameH)
 * Ideal face height occupies 50–75 % of frame height.
 * Returns { ok, ratio, status: 'tooClose'|'tooFar'|'ok' }
 */
export function checkFaceDistance(lm, frameH) {
  const brow = lm[LANDMARK_INDICES.glabella];
  const chin = lm[LANDMARK_INDICES.menton];
  if (!brow || !chin) return { ok: false, ratio: 0, status: 'noFace' };

  const faceH = Math.abs(chin.y - brow.y);   // normalised [0,1]
  if (faceH < 0.30) return { ok: false, ratio: faceH, status: 'tooFar'   };
  if (faceH > 0.75) return { ok: false, ratio: faceH, status: 'tooClose' };
  return { ok: true,  ratio: faceH, status: 'ok' };
}

/* ── Main analysis function ──────────────────────────────────────────────── */
/**
 * analyseAsymmetry(landmarks, imageData, canvasW, canvasH)
 *
 * @param {Array}      landmarks – 468+ normalised {x,y,z} points from MediaPipe
 * @param {ImageData}  imageData – canvas pixel data for lighting check
 * @param {number}     canvasW   – canvas width  (px)
 * @param {number}     canvasH   – canvas height (px)
 * @returns {AsymmetryReport}
 */
export function analyseAsymmetry(landmarks, imageData, canvasW, canvasH) {
  const lm = landmarks;   // shorthand

  // ── 1. Midline ────────────────────────────────────────────────────────────
  const midline = fitMidline(lm);

  // ── 2. Per-pair metrics ──────────────────────────────────────────────────
  const pairs = BILATERAL_PAIRS.map((pair) => {
    const idxL = LANDMARK_INDICES[pair.left];
    const idxR = LANDMARK_INDICES[pair.right];
    const Ll   = lm[idxL];
    const Lr   = lm[idxR];

    if (!Ll || !Lr) return { ...pair, dL: 0, dR: 0, ai: 0, aiPct: 0, valid: false };

    const dL = pointToLineDistance(Ll, midline.A, midline.dHat);
    const dR = pointToLineDistance(Lr, midline.A, midline.dHat);

    const mean = (dL + dR) / 2;
    // Asymmetry Index as % deviation from mean bilateral distance
    const ai    = Math.abs(dL - dR);
    const aiPct = mean > 1e-6 ? (ai / mean) * 100 : 0;

    // Horizontal alignment – deviation of the pair line from horizontal
    const pairAngle = Math.abs(angleDeg(Ll, Lr));  // should be ≈ 0 (horizontal)
    const horizDev  = pairAngle > 90 ? 180 - pairAngle : pairAngle;

    return {
      ...pair,
      dL:        parseFloat((dL * 1000).toFixed(3)),   // ×1000 for readability (milli-units)
      dR:        parseFloat((dR * 1000).toFixed(3)),
      ai:        parseFloat((ai * 1000).toFixed(3)),
      aiPct:     parseFloat(aiPct.toFixed(2)),
      horizDev:  parseFloat(horizDev.toFixed(2)),
      valid:     true,
    };
  });

  const validPairs = pairs.filter((p) => p.valid);

  // ── 3. Global asymmetry score (weighted mean AI%) ─────────────────────────
  const totalWeight = validPairs.reduce((s, p) => s + p.weight, 0);
  const globalScore = totalWeight > 0
    ? validPairs.reduce((s, p) => s + p.aiPct * p.weight, 0) / totalWeight
    : 0;

  // ── 4. Interpupillary & intercommissural line angles ─────────────────────
  const lPupil   = lm[LANDMARK_INDICES.leftPupil]    || lm[LANDMARK_INDICES.leftExocanthion];
  const rPupil   = lm[LANDMARK_INDICES.rightPupil]   || lm[LANDMARK_INDICES.rightExocanthion];
  const lMouth   = lm[LANDMARK_INDICES.leftCheilion];
  const rMouth   = lm[LANDMARK_INDICES.rightCheilion];

  const ipAngle  = lPupil  && rPupil  ? parseFloat((-angleDeg(lPupil,  rPupil)).toFixed(2))  : 0;
  const icAngle  = lMouth  && rMouth  ? parseFloat((-angleDeg(lMouth,  rMouth)).toFixed(2))  : 0;

  // ── 5. Head pose ─────────────────────────────────────────────────────────
  const headPose = estimateHeadPose(lm);

  // ── 6. Lighting ──────────────────────────────────────────────────────────
  const lighting = analyseLighting(imageData, lm, canvasW, canvasH);

  // ── 7. Distance check ────────────────────────────────────────────────────
  const distCheck = checkFaceDistance(lm, canvasH);

  // ── 8. Symmetry grade ────────────────────────────────────────────────────
  const grade = scoreToGrade(globalScore);

  // ── 9. Key landmark coords for rendering (normalised) ────────────────────
  const keyPoints = Object.entries(LANDMARK_INDICES).reduce((acc, [name, idx]) => {
    if (lm[idx]) acc[name] = { x: lm[idx].x, y: lm[idx].y };
    return acc;
  }, {});

  return {
    globalScore: parseFloat(globalScore.toFixed(2)),
    grade,
    pairs,
    midline: {
      Ax: parseFloat(midline.A.x.toFixed(4)),
      Ay: parseFloat(midline.A.y.toFixed(4)),
      Dx: parseFloat(midline.dHat.x.toFixed(4)),
      Dy: parseFloat(midline.dHat.y.toFixed(4)),
    },
    ipAngle,
    icAngle,
    headPose,
    lighting,
    distCheck,
    keyPoints,
    timestamp: Date.now(),
  };
}

/* ── Grade helper ────────────────────────────────────────────────────────── */
function scoreToGrade(score) {
  if (score < 3)  return { label: 'Highly Symmetric', color: '#10b981', tier: 'S' };
  if (score < 6)  return { label: 'Very Symmetric',   color: '#22c55e', tier: 'A' };
  if (score < 10) return { label: 'Symmetric',        color: '#84cc16', tier: 'B' };
  if (score < 15) return { label: 'Mild Asymmetry',   color: '#f59e0b', tier: 'C' };
  if (score < 22) return { label: 'Moderate Asymmetry',color: '#f97316', tier: 'D' };
  return             { label: 'Notable Asymmetry',    color: '#f43f5e', tier: 'E' };
}
