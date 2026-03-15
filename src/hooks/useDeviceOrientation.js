/**
 * useDeviceOrientation.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads the device's physical orientation via the DeviceOrientation API
 * (gyroscope / accelerometer).
 *
 * Returns:
 *   alpha  – compass heading (Z-axis rotation, 0–360°)
 *   beta   – front-to-back tilt  (-180 to 180°)  ← most useful for "phone tilt"
 *   gamma  – left-to-right tilt  (-90 to 90°)
 *   isTilted – true when device is tilted > 10° from ideal portrait
 *   tiltWarning – human-readable string
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';

const TILT_THRESHOLD = 10; // degrees

export function useDeviceOrientation() {
  const [orientation, setOrientation] = useState({ alpha: 0, beta: 90, gamma: 0 });
  const [isTilted,    setIsTilted]    = useState(false);
  const [tiltWarning, setTiltWarning] = useState(null);
  const [supported,   setSupported]   = useState(true);

  useEffect(() => {
    if (!window.DeviceOrientationEvent) {
      setSupported(false);
      return;
    }

    const handler = (e) => {
      const alpha = e.alpha ?? 0;
      const beta  = e.beta  ?? 90;
      const gamma = e.gamma ?? 0;

      setOrientation({ alpha, beta, gamma });

      // In portrait mode holding phone up:  beta ≈ 90°, gamma ≈ 0°
      const betaDev  = Math.abs(beta  - 90);
      const gammaDev = Math.abs(gamma);
      const tilted   = betaDev > TILT_THRESHOLD || gammaDev > TILT_THRESHOLD;

      setIsTilted(tilted);
      if (tilted) {
        const parts = [];
        if (gammaDev > TILT_THRESHOLD) parts.push(`rotate phone ${gamma > 0 ? 'left' : 'right'}`);
        if (betaDev  > TILT_THRESHOLD) parts.push(`tilt phone ${beta < 90 ? 'away from you' : 'toward you'}`);
        setTiltWarning('Hold phone upright: ' + parts.join(', '));
      } else {
        setTiltWarning(null);
      }
    };

    // iOS 13+ requires permission
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then((state) => {
          if (state === 'granted') window.addEventListener('deviceorientation', handler);
          else setSupported(false);
        })
        .catch(() => setSupported(false));
    } else {
      window.addEventListener('deviceorientation', handler);
    }

    return () => window.removeEventListener('deviceorientation', handler);
  }, []);

  return { ...orientation, isTilted, tiltWarning, supported };
}
