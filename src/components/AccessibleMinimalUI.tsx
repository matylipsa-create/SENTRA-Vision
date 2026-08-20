import { useEffect, useRef, useCallback, useState } from 'react';
import { useApp } from '../context/AppContext';
import DetectionVoiceBridge from '../voice/detection-voice-bridge';
import vm from '../voice/manager';

const DETECTION_INTERVAL_MS = 1000;
const OCR_INTERVAL_MS = 5000;
const OCR_CANVAS_W = 640;

export default function AccessibleMinimalUI(): JSX.Element {
  const { state, updateSettings, setSensors, setTfjsStatus, setDetectedObjects } = useApp();

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ocrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bridgeRef = useRef<DetectionVoiceBridge | null>(null);
  const modelRef = useRef<any>(null);
  const loadingModelRef = useRef(false);
  const ocrWorkerRef = useRef<any>(null);
  const ocrLoadingRef = useRef(false);
  const ocrBusyRef = useRef(false);
  const [statusMsg, setStatusMsg] = useState('Sentra Vision listo. Toque el botón para activar la descripción del entorno.');
  const [cameraReady, setCameraReady] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [ocrReady, setOcrReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastOcrText, setLastOcrText] = useState<string | null>(null);

  const realMode = !!state.settings.realMode;

  useEffect(() => {
    bridgeRef.current = new DetectionVoiceBridge(undefined, {
      scoreThreshold: 0.5,
      minFramesToConfirm: 3,
      forgetMs: 3000,
      speakPriority: 0,
    });
    return () => {
      if (detectionTimerRef.current) clearInterval(detectionTimerRef.current);
      if (ocrTimerRef.current) clearInterval(ocrTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (ocrWorkerRef.current) {
        ocrWorkerRef.current.terminate().catch(() => {});
        ocrWorkerRef.current = null;
      }
      vm.cancel();
    };
  }, []);

  const loadModel = useCallback(async () => {
    if (modelRef.current || loadingModelRef.current) return modelRef.current;
    loadingModelRef.current = true;
    try {
      const coco = await import('@tensorflow-models/coco-ssd');
      await import('@tensorflow/tfjs');
      modelRef.current = await coco.load({ base: 'lite_mobilenet_v2' });
      setTfjsStatus(true, false);
      setModelReady(true);
      return modelRef.current;
    } catch {
      modelRef.current = null;
      setTfjsStatus(false, true);
      setModelReady(false);
      return null;
    } finally {
      loadingModelRef.current = false;
    }
  }, [setTfjsStatus]);

  const loadOcrWorker = useCallback(async () => {
    if (ocrWorkerRef.current || ocrLoadingRef.current) return ocrWorkerRef.current;
    ocrLoadingRef.current = true;
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker({ langPath: 'spa' } as any);
      ocrWorkerRef.current = worker;
      setOcrReady(true);
      return worker;
    } catch {
      ocrWorkerRef.current = null;
      setOcrReady(false);
      return null;
    } finally {
      ocrLoadingRef.current = false;
    }
  }, []);

  const startStream = useCallback(async () => {
    if (!realMode) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setSensors({ cameraActive: false, cameraError: null });
      setCameraReady(false);
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        const msg = 'getUserMedia no soportado en este navegador';
        setSensors({ cameraError: msg, cameraActive: false });
        setErrorMsg(msg);
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
      setCameraReady(true);
      setErrorMsg(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al acceder a la cámara';
      setSensors({ cameraError: msg, cameraActive: false });
      setErrorMsg(msg);
      setStatusMsg(`Error: ${msg}. Toque el botón para reintentar.`);
    }
  }, [realMode, setSensors]);

  const runDetection = useCallback(async () => {
    if (!realMode || !cameraReady) return;

    const model = modelRef.current;
    if (!model || !videoRef.current || !videoRef.current.videoWidth) return;

    try {
      const predictions = await model.detect(videoRef.current, 20, 0.5);
      const videoW = videoRef.current.videoWidth;
      const videoH = videoRef.current.videoHeight;

      setDetectedObjects(predictions);

      if (bridgeRef.current && predictions.length > 0) {
        bridgeRef.current.handlePredictions(predictions, videoW, videoH);
      }
    } catch {
      // swallow per-frame errors
    }
  }, [realMode, cameraReady, setDetectedObjects]);

  const runOcr = useCallback(async () => {
    if (!realMode || !cameraReady || !ocrWorkerRef.current || ocrBusyRef.current) return;
    if (!videoRef.current || !videoRef.current.videoWidth) return;

    ocrBusyRef.current = true;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const scale = OCR_CANVAS_W / video.videoWidth;
      canvas.width = OCR_CANVAS_W;
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) return;
      ctx2d.drawImage(video, 0, 0, canvas.width, canvas.height);

      const { data } = await ocrWorkerRef.current.recognize(canvas);
      const text = (data?.text || '').trim();

      if (text && text.length >= 3 && text !== lastOcrText) {
        setLastOcrText(text);
        bridgeRef.current?.speakOcrText(text);
      }
    } catch {
      // swallow OCR errors
    } finally {
      ocrBusyRef.current = false;
    }
  }, [realMode, cameraReady, lastOcrText]);

  useEffect(() => {
    startStream();

    if (realMode) {
      loadModel().then(() => {
        setStatusMsg('Cámara activa. Describiendo el entorno.');
        vm.speak('Cámara activa. Comenzando a describir el entorno.', 2, { interrupt: true, rate: 1.15 });
      });

      loadOcrWorker();

      if (detectionTimerRef.current) clearInterval(detectionTimerRef.current);
      detectionTimerRef.current = setInterval(runDetection, DETECTION_INTERVAL_MS);

      if (ocrTimerRef.current) clearInterval(ocrTimerRef.current);
      ocrTimerRef.current = setInterval(runOcr, OCR_INTERVAL_MS);
    } else {
      if (detectionTimerRef.current) {
        clearInterval(detectionTimerRef.current);
        detectionTimerRef.current = null;
      }
      if (ocrTimerRef.current) {
        clearInterval(ocrTimerRef.current);
        ocrTimerRef.current = null;
      }
      setDetectedObjects([]);
      setLastOcrText(null);
      if (cameraReady) {
        setStatusMsg('Descripción detenida. Toque el botón para reactivar.');
        vm.speak('Descripción detenida.', 2, { interrupt: true, rate: 1.15 });
      }
    }

    return () => {
      if (detectionTimerRef.current) {
        clearInterval(detectionTimerRef.current);
        detectionTimerRef.current = null;
      }
      if (ocrTimerRef.current) {
        clearInterval(ocrTimerRef.current);
        ocrTimerRef.current = null;
      }
    };
  }, [realMode, startStream, loadModel, loadOcrWorker, runDetection, runOcr, cameraReady, setDetectedObjects]);

  const toggle = () => {
    if (navigator.vibrate) navigator.vibrate(50);
    updateSettings({ realMode: !realMode });

    if (!realMode) {
      setStatusMsg('Activando cámara y descripción...');
      vm.speak('Activando la descripción del entorno.', 2, { interrupt: true, rate: 1.15 });
    } else {
      setStatusMsg('Desactivando descripción...');
      vm.speak('Desactivando la descripción del entorno.', 2, { interrupt: true, rate: 1.15 });
    }

    setTimeout(() => btnRef.current?.focus(), 200);
  };

  useEffect(() => {
    btnRef.current?.focus();
  }, []);

  const buttonLabel = realMode ? 'Desactivar descripción del entorno' : 'Activar descripción del entorno';
  const buttonState = realMode ? 'Desactivar' : 'Activar';

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
          role="status"
          style={{
            textAlign: 'center',
            fontSize: 18,
            fontWeight: 600,
            color: '#FDE047',
            minHeight: 28,
          }}
        >
          {errorMsg ? `Error: ${errorMsg}` : statusMsg}
        </div>

        <button
          ref={btnRef}
          onClick={toggle}
          aria-pressed={realMode}
          aria-label={buttonLabel}
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
            transition: 'background 0.2s ease',
          }}
        >
          <span style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>
            {buttonState}
          </span>
        </button>

        <div
          style={{
            textAlign: 'center',
            fontSize: 16,
            color: '#E5E7EB',
            opacity: 0.9,
          }}
          aria-hidden="true"
        >
          Presione el botón para {realMode ? 'detener la descripción' : 'comenzar a describir el entorno'}.
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 12,
            marginTop: 8,
            flexWrap: 'wrap',
          }}
          aria-hidden="true"
        >
          <span style={{
            fontSize: 13,
            color: cameraReady ? '#22C55E' : '#6B7280',
            fontWeight: 600,
          }}>
            Cámara: {cameraReady ? 'Activa' : 'Inactiva'}
          </span>
          <span style={{
            fontSize: 13,
            color: modelReady ? '#22C55E' : '#6B7280',
            fontWeight: 600,
          }}>
            IA: {modelReady ? 'Cargada' : 'Cargando...'}
          </span>
          <span style={{
            fontSize: 13,
            color: ocrReady ? '#22C55E' : '#6B7280',
            fontWeight: 600,
          }}>
            OCR: {ocrReady ? 'Listo' : 'Cargando...'}
          </span>
        </div>

        {lastOcrText && (
          <div
            aria-live="polite"
            style={{
              textAlign: 'center',
              fontSize: 14,
              color: '#93C5FD',
              minHeight: 20,
              padding: '8px 12px',
              background: 'rgba(30,58,138,0.3)',
              borderRadius: 8,
            }}
            aria-label={`Último texto detectado: ${lastOcrText}`}
          >
            Texto: {lastOcrText}
          </div>
        )}

        <div
          id="a11y-announcer"
          aria-live="assertive"
          aria-atomic="true"
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
