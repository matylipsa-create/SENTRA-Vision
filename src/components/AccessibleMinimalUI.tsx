// src/components/AccessibleMinimalUI.tsx
// Interfaz accesible para Sentra Visión — Un solo botón, voz, vibración, doble toque
// Diseñada para personas ciegas o con baja visión — TalkBack/NVDA compatible

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { evolis } from '../core/EVOLIS';
import { moralNode } from '../core/MoralNode';
import { geminiService } from '../services/GeminiService';
import { useRealModeSensors } from '../hooks/useRealModeSensors';
import './AccessibleMinimalUI.css';

// ============================================================
// 1. PROPS
// ============================================================

interface AccessibleMinimalUIProps {
  onActivate?: () => void;
  onDeactivate?: () => void;
  onDetection?: (objects: Array<{ class: string; confidence: number }>) => void;
  onError?: (error: Error) => void;
  enableVoice?: boolean;
  enableHaptic?: boolean;
  enableEthics?: boolean;
  enableTracing?: boolean;
  enableContext?: boolean;
}

// ============================================================
// 2. COMPONENTE PRINCIPAL
// ============================================================

export const AccessibleMinimalUI: React.FC<AccessibleMinimalUIProps> = ({
  onActivate,
  onDeactivate,
  onDetection,
  onError,
  enableVoice = true,
  enableHaptic = true,
  enableEthics = true,
  enableTracing = true,
  enableContext = true
}) => {
  // ============================================================
  // 3. ESTADO
  // ============================================================

  const [isActive, setIsActive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'INACTIVA' | 'ACTIVA' | 'ERROR'>('INACTIVA');
  const [detectionCount, setDetectionCount] = useState(0);
  const [detectedLabels, setDetectedLabels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ethicalFilterActive, setEthicalFilterActive] = useState(enableEthics);
  const [chainVerified, setChainVerified] = useState(true);
  const [vetoRequired, setVetoRequired] = useState(false);
  const [lastVetoDecision, setLastVetoDecision] = useState<string | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [isModelLoading, setIsModelLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const lastDetectionCountRef = useRef(0);

  // ============================================================
  // 4. FUNCIONES DE VOZ
  // ============================================================

  const speak = useCallback((text: string) => {
    if (!enableVoice) return;
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }, [enableVoice]);

  // ============================================================
  // 5. FUNCIONES DE VIBRACIÓN
  // ============================================================

  const vibrate = useCallback((duration: number = 50) => {
    if (!enableHaptic) return;
    if (navigator.vibrate) {
      navigator.vibrate(duration);
    }
  }, [enableHaptic]);

  // ============================================================
  // 6. HOOK DE DETECCIÓN
  // ============================================================

  const {
    detections,
    filteredDetections,
    error: detectionError,
    isModelLoaded,
    isLoading,
    ethicalFilterActive: ethicsActive,
    isVetoRequired,
    lastVetoDecision: vetoDecision,
    chainVerified: chainOk,
    getChainStats,
    evolis: evolisInstance
  } = useRealModeSensors({
    videoRef,
    enabled: isActive,
    enableEthics,
    enableTracing,
    enableContext,
    onDetection: (objects) => {
      const labels = objects.map(o => o.class);
      setDetectedLabels(labels);
      setDetectionCount(objects.length);
      
      if (onDetection) {
        onDetection(objects);
      }

      // Anunciar cambios significativos
      if (objects.length > 0 && objects.length % 3 === 0) {
        const topObjects = labels.slice(0, 3).join(', ');
        speak(`Detectados: ${topObjects}`);
        vibrate(30);
      }
    },
    onEthicalFilter: (objects, allowed) => {
      if (!allowed) {
        speak('⚠️ Filtro ético activado');
        vibrate(100);
      }
    }
  });

  // ============================================================
  // 7. MANEJO DE ACTIVACIÓN/DESACTIVACIÓN
  // ============================================================

  const handleToggle = useCallback(async () => {
    vibrate(50);

    const newState = !isActive;
    setIsActive(newState);

    if (newState) {
      speak('Activando visión');
      setCameraStatus('ACTIVA');
      setError(null);

      if (videoRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
          });
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          speak('Cámara activada');

          if (onActivate) {
            onActivate();
          }

          // Registrar evento de activación en EVOLIS
          if (enableTracing && evolisInstance) {
            evolisInstance.registerEvent('ACTION', { action: 'ACTIVATE', timestamp: Date.now() });
          }

        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Error al activar cámara';
          speak('Error al activar cámara');
          setError(errorMsg);
          setCameraStatus('ERROR');
          setIsActive(false);

          if (onError && err instanceof Error) {
            onError(err);
          }
        }
      }
    } else {
      speak('Desactivando visión');
      setCameraStatus('INACTIVA');
      setDetectionCount(0);
      setDetectedLabels([]);

      if (onDeactivate) {
        onDeactivate();
      }

      // Registrar evento de desactivación en EVOLIS
      if (enableTracing && evolisInstance) {
        evolisInstance.registerEvent('ACTION', { action: 'DEACTIVATE', timestamp: Date.now() });
      }

      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }
  }, [isActive, speak, vibrate, onActivate, onDeactivate, onError, enableTracing, evolisInstance]);

  // ============================================================
  // 8. DOBLE TOQUE EN PANTALLA
  // ============================================================

  useEffect(() => {
    const handleDoubleTap = (e: TouchEvent) => {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current;

      if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
        e.preventDefault();
        handleToggle();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('touchstart', handleDoubleTap, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('touchstart', handleDoubleTap);
      }
    };
  }, [handleToggle]);

  // ============================================================
  // 9. ACTUALIZAR INDICADORES DE ÉTICA Y TRAZABILIDAD
  // ============================================================

  useEffect(() => {
    setEthicalFilterActive(ethicsActive);
    setChainVerified(chainOk);
    setVetoRequired(isVetoRequired);
    setLastVetoDecision(vetoDecision);

    if (isVetoRequired) {
      speak('🔒 Veto humano requerido');
      vibrate(100);
    }

    if (evolisInstance) {
      const stats = evolisInstance.getStats();
      setEventCount(stats.totalEvents);
    }
  }, [ethicsActive, chainOk, isVetoRequired, vetoDecision, evolisInstance, speak, vibrate]);

  // ============================================================
  // 10. KEYBOARD NAVIGATION
  // ============================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter o Espacio para activar/desactivar
      if (e.key === 'Enter' || e.key === ' ') {
        const target = e.target as HTMLElement;
        if (target && target.classList.contains('main-button')) {
          e.preventDefault();
          handleToggle();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleToggle]);

  // ============================================================
  // 11. RENDER
  // ============================================================

  return (
    <div
      ref={containerRef}
      className="accessible-minimal-ui"
      role="application"
      aria-label="Sentra Visión — Asistente Visual Cognitivo"
    >
      {/* TÍTULO */}
      <h1
        className="app-title"
        role="heading"
        aria-level={1}
        aria-label="Sentra Visión"
      >
        🎯 Sentra Visión
      </h1>

      {/* BOTÓN PRINCIPAL */}
      <button
        className={`main-button ${isActive ? 'active' : 'inactive'}`}
        onClick={handleToggle}
        aria-label={isActive ? 'Desactivar visión' : 'Activar visión'}
        aria-pressed={isActive}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        {isActive ? 'DESACTIVAR' : 'ACTIVAR'}
      </button>

      {/* ESTADO */}
      <div
        className="status-container"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <p className="status-text">
          <span className={`status-dot ${cameraStatus.toLowerCase()}`} />
          Cámara: {cameraStatus}
        </p>

        {isActive && (
          <>
            <p className="detection-text">
              👁️ Objetos detectados: {detectionCount}
            </p>
            {detectedLabels.length > 0 && (
              <p className="labels-text">
                {detectedLabels.slice(0, 3).join(', ')}
              </p>
            )}
          </>
        )}

        {error && (
          <p className="error-text" role="alert">
            ⚠️ {error}
          </p>
        )}

        {isLoading && (
          <p className="loading-text">🔄 Cargando modelo de IA...</p>
        )}

        {/* INDICADORES DE ÉTICA Y TRAZABILIDAD */}
        {isActive && (
          <div className="ethics-indicators">
            <span className={`indicator ${ethicalFilterActive ? 'active' : 'inactive'}`}>
              {ethicalFilterActive ? '🛡️ Ética activa' : '⚠️ Ética desactivada'}
            </span>
            <span className={`indicator ${chainVerified ? 'active' : 'inactive'}`}>
              {chainVerified ? '🔗 Cadena verificada' : '⚠️ Cadena rota'}
            </span>
            {vetoRequired && (
              <span className="indicator veto">
                🔒 Veto: {lastVetoDecision || 'Acción crítica'}
              </span>
            )}
            {eventCount > 0 && (
              <span className="indicator info">
                📋 Eventos: {eventCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* HINT DE DOBLE TOQUE */}
      <p className="gesture-hint" aria-hidden="true">
        Doble toque en pantalla para activar/desactivar
      </p>

      {/* FOOTER */}
      <div className="footer">
        <p className="version-text">
          v3.1.2-PROT · Soberanía del dato
        </p>
        <p className="slogan-text">
          Cuando todo lo demás se apaga, Sentra Core sigue ahí.
        </p>
      </div>

      {/* VIDEO OCULTO */}
      <video
        ref={videoRef}
        className="hidden-video"
        aria-hidden="true"
        playsInline
      />
    </div>
  );
};

// ============================================================
// 12. EXPORTACIÓN POR DEFECTO
// ============================================================

export default AccessibleMinimalUI;
