import { useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import useRealModeSensors from '../hooks/useRealModeSensors';
import DetectionVoiceBridge from '../voice/detection-voice-bridge';
import vm from '../voice/manager';

export default function AccessibleMinimalUI(): JSX.Element {
  const { state, updateSettings, setSensors, setTfjsStatus } = useApp();
  const { setVideo } = useRealModeSensors();

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionRafRef = useRef<number | null>(null);
  const bridgeRef = useRef<DetectionVoiceBridge | null>(null);
  const modelRef = useRef<any>(null);
  const loadingModelRef = useRef(false);

  const realMode = !!state.settings.realMode;
  const audioStatus = realMode ? 'Activo' : 'Inactivo';
  const ariaStatus = `Audio ${audioStatus}`;

  // Instantiate the voice bridge once
  useEffect(() => {
    bridgeRef.current = new DetectionVoiceBridge();
    return () => {
      if (detectionRafRef.current) cancelAnimationFrame(detectionRafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load COCO-SSD model (self-contained, no external detector import)
  const loadModel = useCallback(async () => {
    if (modelRef.current || loadingModelRef.current) return modelRef.current;
    loadingModelRef.current = true;
    try {
      const coco = await import('@tensorflow-models/coco-ssd');
      await import('@tensorflow/tfjs');
      modelRef.current = await coco.load();
      setTfjsStatus(true, false);
      return modelRef.current;
    } catch {
      modelRef.current = null;
      setTfjsStatus(false, true);
      return null;
    } finally {
      loadingModelRef.current = false;
    }
  }, [setTfjsStatus]);

  // Start / stop camera stream based on realMode
  const startStream = useCallback(async () => {
    if (!realMode) {
      // stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setSensors({ cameraActive: false, cameraError: null });
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        const msg = 'getUserMedia no soportado en este navegador';
        setSensors({ cameraError: msg, cameraActive: false });
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setSensors({ cameraActive: true, cameraError: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al acceder a la camara';
      setSensors({ cameraError: msg, cameraActive: false });
    }
  }, [realMode, setSensors]);

  // Detection loop — feeds predictions to DetectionVoiceBridge
  const runDetection = useCallback(async () => {
    if (!realMode) return;

    const model = await loadModel();
    if (!model || !videoRef.current || !videoRef.current.videoWidth) {
      detectionRafRef.current = requestAnimationFrame(runDetection);
      return;
    }

    try {
      const predictions = await model.detect(videoRef.current, 20, 0.5);
      const videoW = videoRef.current.videoWidth;
      const videoH = videoRef.current.videoHeight;
      if (bridgeRef.current && predictions.length > 0) {
        bridgeRef.current.handlePredictions(predictions, videoW, videoH);
      }
    } catch {
      // swallow per-frame errors
    }

    detectionRafRef.current = requestAnimationFrame(runDetection);
  }, [realMode, loadModel]);

  // Manage camera + detection lifecycle
  useEffect(() => {
    startStream();

    if (realMode) {
      // kick off detection loop
      detectionRafRef.current = requestAnimationFrame(runDetection);
    } else {
      if (detectionRafRef.current) {
        cancelAnimationFrame(detectionRafRef.current);
        detectionRafRef.current = null;
      }
    }

    return () => {
      if (detectionRafRef.current) {
        cancelAnimationFrame(detectionRafRef.current);
        detectionRafRef.current = null;
      }
    };
  }, [realMode, startStream, runDetection]);

  // Pass video element to the sensors hook (for any other consumers)
  useEffect(() => {
    setVideo(videoRef.current);
  });

  const toggle = () => {
    updateSettings({ realMode: !realMode });

    try {
      const text = realMode ? 'Desactivando la descripción' : 'Activando la descripción';
      vm.speak(text, 1, { interrupt: true });
    } catch {
      try {
        if ('speechSynthesis' in window) {
          const utter = new SpeechSynthesisUtterance(realMode ? 'Desactivando' : 'Activando');
          utter.lang = 'es-ES';
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utter);
        }
      } catch {}
    }

    setTimeout(() => btnRef.current?.focus(), 200);
  };

  useEffect(() => {
    btnRef.current?.focus();
  }, []);

  return (
    <main
      role="main"
      aria-label="Sentra Vision — Asistente visual para personas ciegas"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        color: '#FFFFFF',
        padding: '24px',
        gap: 20,
      }}
    >
      {/* Hidden camera video — aria-hidden because the voice description replaces it for blind users */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
          top: 0,
          left: 0,
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: 520,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 20,
        }}
      >
        <div
          aria-live="polite"
          aria-atomic="true"
          style={{
            textAlign: 'center',
            fontSize: 20,
            fontWeight: 700,
            color: '#FDE047',
          }}
        >
          {ariaStatus}
        </div>

        <button
          ref={btnRef}
          onClick={toggle}
          aria-pressed={realMode}
          aria-label={realMode ? 'Desactivar descripción del entorno' : 'Activar descripción del entorno'}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: realMode ? '#DC2626' : '#FBBF24',
            color: '#000',
            borderRadius: 16,
            height: 160,
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 6px 18px rgba(0,0,0,0.6)',
            userSelect: 'none',
          }}
        >
          <span style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>
            {realMode ? 'Desactivar' : 'Activar'}
          </span>
        </button>

        <div
          style={{
            textAlign: 'center',
            fontSize: 16,
            color: '#E5E7EB',
            opacity: 0.9,
          }}
        >
          Presione el botón para {realMode ? 'detener la descripción' : 'comenzar a describir el entorno'}.
        </div>

        <div
          id="a11y-announcer"
          aria-live="assertive"
          style={{
            position: 'absolute',
            left: '-10000px',
            top: 'auto',
            width: 1,
            height: 1,
            overflow: 'hidden',
          }}
        />
      </div>
    </main>
  );
}
