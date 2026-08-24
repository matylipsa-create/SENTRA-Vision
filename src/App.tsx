import { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';
import { useObjectDetection } from './hooks/useObjectDetection';

const LABEL_ES: Record<string, string> = {
  person: 'persona', dog: 'perro', cat: 'gato', car: 'auto', bicycle: 'bicicleta',
  bottle: 'botella', chair: 'silla', couch: 'sofá', tv: 'televisor', laptop: 'computadora',
  motorcycle: 'moto', bus: 'colectivo', truck: 'camión', backpack: 'mochila',
  handbag: 'bolso', suitcase: 'valija', 'cell_phone': 'celular', cup: 'taza',
  fork: 'tenedor', knife: 'cuchillo', spoon: 'cuchara', bowl: 'cuenco',
  clock: 'reloj', vase: 'jarrón', scissors: 'tijeras', toilet: 'inodoro',
  sink: 'pileta', mouse: 'mouse', keyboard: 'teclado', remote: 'control remoto',
  microwave: 'microondas', oven: 'horno', refrigerator: 'heladera',
  book: 'libro', 'potted_plant': 'planta', 'dining_table': 'mesa', bed: 'cama',
  'stop_sign': 'cartel de pare', 'fire_hydrant': 'boca de incendio',
  'parking_meter': 'parquímetro', bench: 'banco', umbrella: 'paraguas',
  'traffic_light': 'semáforo',
};

function labelToEs(label: string): string {
  return LABEL_ES[label] || label;
}

function App() {
  const [isActive, setIsActive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('INACTIVA');
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('Sentra Visión listo. Toque el botón para activar.');
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const lastSpokenCountRef = useRef<number>(0);
  const lastSpokenTsRef = useRef<number>(0);

  const { count, labels, modelReady, modelError } = useObjectDetection(videoRef, isActive);

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
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
      setCameraStatus('CONECTANDO');
      setError(null);
      setStatusMsg('Activando cámara...');
      if (videoRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraStatus('ACTIVA');
          setStatusMsg('Cámara activa. Analizando entorno.');
          speak('Cámara activada. Comenzando a analizar el entorno.');
        } catch {
          speak('Error al activar cámara');
          setError('No se pudo acceder a la cámara');
          setStatusMsg('Error: no se pudo acceder a la cámara');
          setIsActive(false);
          setCameraStatus('INACTIVA');
        }
      }
    } else {
      speak('Desactivando visión');
      setCameraStatus('INACTIVA');
      setStatusMsg('Visión desactivada. Toque el botón para reactivar.');
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

  useEffect(() => {
    if (!isActive || !modelReady || count === 0) return;
    const now = Date.now();
    if (now - lastSpokenTsRef.current < 3000) return;
    if (count === lastSpokenCountRef.current) return;

    lastSpokenTsRef.current = now;
    lastSpokenCountRef.current = count;

    const uniqueLabels = [...new Set(labels)];
    const esLabels = uniqueLabels.slice(0, 5).map(labelToEs);
    const text = count === 1
      ? `Se detectó ${esLabels[0]}`
      : `Se detectaron ${count} objetos: ${esLabels.join(', ')}`;

    speak(text);
    if (navigator.vibrate) navigator.vibrate(30);
  }, [count, labels, isActive, modelReady, speak]);

  useEffect(() => {
    if (isActive && modelError) {
      setStatusMsg('No se pudo cargar el modelo de detección');
      speak('No se pudo cargar el modelo de detección de objetos');
    }
  }, [modelError, isActive, speak]);

  useEffect(() => {
    if (isActive && modelReady && !modelError) {
      setStatusMsg('Cámara activa. Analizando entorno.');
    }
  }, [modelReady, isActive, modelError]);

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
        <p className="status-text">
          <span className="status-dot" data-status={cameraStatus} /> Cámara: {cameraStatus}
        </p>
        {isActive && (
          <>
            <p className="detection-text">Objetos detectados: {count}</p>
            {count > 0 && (
              <p className="labels-text" aria-label={`Objetos: ${[...new Set(labels)].slice(0, 5).map(labelToEs).join(', ')}`}>
                {[...new Set(labels)].slice(0, 5).map(labelToEs).join(', ')}
              </p>
            )}
          </>
        )}
        {isActive && !modelReady && !modelError && (
          <p className="loading-text">Cargando modelo de IA...</p>
        )}
        {error && <p className="error-text" role="alert">Error: {error}</p>}
      </div>
      <p className="status-msg" aria-live="polite">{statusMsg}</p>
      <p className="gesture-hint" aria-hidden="true">Doble toque en pantalla para activar/desactivar</p>
      <p className="version-text">v3.1.2-PROT · Soberanía del dato</p>
      <video ref={videoRef} className="hidden-video" aria-hidden="true" playsInline muted />
    </div>
  );
}

export default App;
