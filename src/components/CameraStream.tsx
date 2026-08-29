// src/components/CameraStream.tsx
// Componente de transmisión de cámara para Sentra Visión
// Soporte para cámara trasera/delantera, procesamiento de frames y detección

import React, { useState, useRef, useCallback, useEffect } from 'react';
import './CameraStream.css';

// ============================================================
// 1. TIPOS E INTERFACES
// ============================================================

interface CameraStreamProps {
  onFrame?: (imageData: ImageData) => void;
  onStreamReady?: (stream: MediaStream) => void;
  onError?: (error: Error) => void;
  facingMode?: 'user' | 'environment';
  resolution?: { width: number; height: number };
  autoStart?: boolean;
  className?: string;
  showControls?: boolean;
}

// ============================================================
// 2. COMPONENTE PRINCIPAL
// ============================================================

export const CameraStream: React.FC<CameraStreamProps> = ({
  onFrame,
  onStreamReady,
  onError,
  facingMode = 'environment',
  resolution = { width: 640, height: 480 },
  autoStart = false,
  className = '',
  showControls = true
}) => {
  // ============================================================
  // 3. ESTADO
  // ============================================================

  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  // ============================================================
  // 4. FUNCIONES DE CÁMARA
  // ============================================================

  /**
   * Inicia la transmisión de la cámara
   */
  const startCamera = useCallback(async () => {
    if (isStreaming) return;

    setIsLoading(true);
    setError(null);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: resolution.width },
          height: { ideal: resolution.height },
          frameRate: { ideal: 30 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
        setError(null);

        if (onStreamReady) {
          onStreamReady(stream);
        }

        // Iniciar procesamiento de frames
        if (onFrame) {
          processFrames();
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al acceder a la cámara';
      setError(errorMsg);
      if (onError && err instanceof Error) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isStreaming, facingMode, resolution, onStreamReady, onFrame, onError]);

  /**
   * Detiene la transmisión de la cámara
   */
  const stopCamera = useCallback(() => {
    setIsMounted(false);

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsStreaming(false);
  }, []);

  /**
   * Procesa los frames para detección
   */
  const processFrames = useCallback(() => {
    if (!isMounted) return;
    if (!videoRef.current || !canvasRef.current || !onFrame) {
      animationRef.current = requestAnimationFrame(processFrames);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      animationRef.current = requestAnimationFrame(processFrames);
      return;
    }

    // Dibujar el frame en el canvas
    canvas.width = video.videoWidth || resolution.width;
    canvas.height = video.videoHeight || resolution.height;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Obtener datos de la imagen
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    onFrame(imageData);

    // Continuar el ciclo
    animationRef.current = requestAnimationFrame(processFrames);
  }, [isMounted, onFrame, resolution]);

  // ============================================================
  // 5. EFECTOS
  // ============================================================

  // Iniciar automáticamente si está configurado
  useEffect(() => {
    if (autoStart) {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [autoStart, startCamera, stopCamera]);

  // Limpiar recursos al desmontar
  useEffect(() => {
    return () => {
      stopCamera();
      isMounted = false;
    };
  }, [stopCamera]);

  // ============================================================
  // 6. RENDER
  // ============================================================

  return (
    <div className={`camera-stream ${className}`}>
      {/* Video */}
      <video
        ref={videoRef}
        className="camera-video"
        playsInline
        muted
        aria-label="Transmisión de cámara"
      />

      {/* Canvas oculto para procesamiento */}
      <canvas
        ref={canvasRef}
        className="camera-canvas"
        style={{ display: 'none' }}
      />

      {/* Estado de carga */}
      {isLoading && (
        <div className="camera-overlay loading">
          <span className="loading-spinner" />
          <p>Iniciando cámara...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="camera-overlay error">
          <span className="error-icon">⚠️</span>
          <p className="error-text">{error}</p>
          <button onClick={startCamera}>Reintentar</button>
        </div>
      )}

      {/* Controles */}
      {showControls && isStreaming && (
        <div className="camera-controls">
          <button
            className="control-button stop"
            onClick={stopCamera}
            aria-label="Detener cámara"
          >
            ⏹️ Detener
          </button>
        </div>
      )}

      {/* Indicador de estado */}
      <div className="camera-status">
        <span className={`status-indicator ${isStreaming ? 'active' : 'inactive'}`} />
        <span className="status-text">
          {isStreaming ? '📷 En vivo' : '📷 Cámara inactiva'}
        </span>
      </div>
    </div>
  );
};

// ============================================================
// 7. EXPORTACIÓN POR DEFECTO
// ============================================================

export default CameraStream;
