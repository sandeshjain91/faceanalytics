import React, { useState, useCallback } from 'react';
import CameraView from './components/CameraView.jsx';
import ResultsPanel from './components/ResultsPanel.jsx';
import IntroScreen from './components/IntroScreen.jsx';

/**
 * App – top-level state machine
 * Screens: 'intro' → 'capture' → 'results'
 */
export default function App() {
  const [screen, setScreen]         = useState('intro');   // 'intro' | 'capture' | 'results'
  const [analysisData, setAnalysis] = useState(null);

  const handleStartCapture = useCallback(() => setScreen('capture'), []);

  const handleCapture = useCallback((data) => {
    setAnalysis(data);
    setScreen('results');
  }, []);

  const handleRetake = useCallback(() => {
    setAnalysis(null);
    setScreen('capture');
  }, []);

  const handleHome = useCallback(() => {
    setAnalysis(null);
    setScreen('intro');
  }, []);

  return (
    <div className="app-root bg-slate-950 min-h-screen min-h-[100dvh] text-white overflow-hidden">
      {screen === 'intro'   && <IntroScreen   onStart={handleStartCapture} />}
      {screen === 'capture' && <CameraView    onCapture={handleCapture} onBack={handleHome} />}
      {screen === 'results' && <ResultsPanel  data={analysisData} onRetake={handleRetake} onHome={handleHome} />}
    </div>
  );
}
