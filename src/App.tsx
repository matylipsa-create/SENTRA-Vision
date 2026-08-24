import { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';

function App() {
  const [isActive, setIsActive] = useState(false);
  const [detectionCount, setDetectionCount] = useState(0);
  const [cameraStatus, setCameraStatus] = useState('INACTIVA');
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const handleToggle = useCallback(async () => {
    if (navigator.vibrate) navigator.vibrate(50);
    const newState = !isActive;
    setIsActive(newState);

    if (newState) {
      speak('Activando visión');
      setCameraStatus('ACTIVA');
      setError(null);
      if (videoRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          speak('Cámara activada');
          setDetectionCount(0);
        } catch {
          speak('Error al activar cámara');
          setError('No se pudo acceder a la cámara');
          setIsActive(false);
          setCameraStatus('INACTIVA');
        }
      }
    } else {
      speak('Desactivando visión');
      setCameraStatus('INACTIVA');
      setDetectionCount(0);
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    }
  }, [isActive, speak]);

  useEffect(() => {
    const handleDoubleTap = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTapRef.current < 300 && lastTapRef.current > 0) {
        e.preventDefault();
        handleToggle();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    };
    const container = containerRef.current;
    if (container) container.addEventListener('touchstart', handleDoubleTap, { passive: false });
    return () => { if (container) container.removeEventListener('touchstart', handleDoubleTap); };
  }, [handleToggle]);

  return (
    <div ref={containerRef} className="app-container" role="application" aria-label="Sentra Visión">
      <h1 className="app-title" role="heading" aria-level={1} aria-label="Sentra Visión">Sentra Visión</h1>
      <button
        className={`main-button ${isActive ? 'active' : 'inactive'}`}
        onClick={handleToggle}
        aria-label={isActive ? 'Desactivar visión' : 'Activar visión'}
        aria-pressed={isActive}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); } }}
      >
        {isActive ? 'DESACTIVAR' : 'ACTIVAR'}
      </button>
      <div className="status-container" role="status" aria-live="polite" aria-atomic="true">
        <p className="status-text"><span className="status-dot" data-status={cameraStatus} /> Cámara: {cameraStatus}</p>
        {isActive && <p className="detection-text">Objetos detectados: {detectionCount}</p>}
        {error && <p className="error-text" role="alert">Error: {error}</p>}
      </div>
      <p className="gesture-hint" aria-hidden="true">Doble toque en pantalla para activar/desactivar</p>
      <p className="version-text">v3.1.2-PROT · Soberanía del dato</p>
      <video ref={videoRef} className="hidden-video" aria-hidden="true" playsInline />
    </div>
  );
}

export default App;
