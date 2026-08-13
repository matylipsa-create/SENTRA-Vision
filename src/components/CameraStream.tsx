import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, RefreshCw, Maximize2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function CameraStream({ setVideo }: { setVideo?: (el: HTMLVideoElement | null) => void }) {
  const { state, setSensors } = useApp();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const realMode = state.settings.realMode;
  const powerSaving = state.settings.powerSavingMode;

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startStream = useCallback(async () => {
    setSwitching(true);
    setConnecting(true);
    stopStream();
    if (!realMode || powerSaving) {
      setSensors({ cameraActive: false, cameraError: null });
      setSwitching(false);
      setConnecting(false);
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        const msg = 'getUserMedia no soportado en este navegador';
        setError(msg);
        setSensors({ cameraError: msg, cameraActive: false });
        setSwitching(false);
        setConnecting(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setError(null);
      setSensors({ cameraActive: true, cameraError: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al acceder a la camara';
      setError(msg);
      setSensors({ cameraError: msg, cameraActive: false });
    } finally {
      setSwitching(false);
      setConnecting(false);
    }
  }, [realMode, powerSaving, facing, stopStream, setSensors]);

  useEffect(() => {
    startStream();
    return stopStream;
  }, [startStream, stopStream]);

  const handleSwitch = () => {
    setFacing(f => f === 'environment' ? 'user' : 'environment');
  };

  const handleFullscreen = () => {
    if (videoRef.current?.requestFullscreen) {
      videoRef.current.requestFullscreen().catch(() => {});
    }
  };

  if (!realMode || powerSaving) {
    return (
      <div className="rounded-xl p-4 flex flex-col items-center gap-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <CameraOff size={24} style={{ color: '#9CA3AF' }} aria-hidden="true" />
        <span className="text-sm text-center" style={{ color: '#9CA3AF' }}>
          {powerSaving ? 'Camara desactivada en modo ahorro' : 'Activa modo Real para ver la camara'}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#000', border: '1px solid rgba(251,191,36,0.3)' }}>
      <div className="relative aspect-video bg-black">
        <video
          ref={(el) => {
            videoRef.current = el;
            setVideo?.(el);
          }}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
          aria-label="Transmisión de cámara en vivo"
        />
        {(switching || connecting) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ background: 'rgba(0,0,0,0.6)' }} role="status" aria-label="Conectando cámara">
            <div className="connecting-dots" aria-hidden="true"><span /><span /><span /></div>
            <span className="text-sm" style={{ color: '#FBBF24' }}>Conectando...</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ background: 'rgba(0,0,0,0.8)' }} role="alert">
            <CameraOff size={24} style={{ color: '#EF4444' }} aria-hidden="true" />
            <span className="text-sm text-center px-4" style={{ color: '#EF4444' }}>{error}</span>
          </div>
        )}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.6)' }} role="img" aria-label="Grabando">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#EF4444' }} aria-hidden="true" />
          <span className="text-sm font-mono text-white">REC</span>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button onClick={handleFullscreen} aria-label="Pantalla completa" className="press-feedback p-1.5 rounded-lg active:scale-90" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <Maximize2 size={14} style={{ color: '#FBBF24' }} aria-hidden="true" />
          </button>
          <button onClick={handleSwitch} aria-label="Cambiar cámara" className="press-feedback p-1.5 rounded-lg active:scale-90" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <RefreshCw size={14} style={{ color: '#FBBF24' }} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between px-3 py-2" style={{ background: 'rgba(10,12,18,0.95)' }}>
        <div className="flex items-center gap-1.5">
          <Camera size={14} style={{ color: state.sensors.cameraActive ? '#22C55E' : '#EF4444' }} aria-hidden="true" />
          <span className="text-sm font-medium" style={{ color: '#9CA3AF' }}>
            {facing === 'environment' ? 'Camara Trasera' : 'Camara Frontal'}
          </span>
        </div>
        <span className="text-sm font-mono" style={{ color: state.sensors.cameraActive ? '#22C55E' : '#EF4444' }} role="status" aria-label={state.sensors.cameraActive ? 'En vivo' : 'Sin señal'}>
          {state.sensors.cameraActive ? 'EN VIVO' : 'SIN SENAL'}
        </span>
      </div>
    </div>
  );
}
