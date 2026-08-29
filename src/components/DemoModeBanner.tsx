// src/components/DemoModeBanner.tsx
// Banner de modo demo para Sentra Core — Indica que el sistema está en modo de demostración
// Muestra métricas y estado del sistema en tiempo real

import React, { useState, useEffect, useRef } from 'react';
import './DemoModeBanner.css';

// ============================================================
// 1. TIPOS E INTERFACES
// ============================================================

interface DemoModeBannerProps {
  isActive?: boolean;
  onDismiss?: () => void;
  onActivate?: () => void;
  onDeactivate?: () => void;
  showMetrics?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number; // ms
}

interface DemoMetrics {
  fps: number;
  latency: number;
  detections: number;
  events: number;
  memory: number;
}

// ============================================================
// 2. COMPONENTE PRINCIPAL
// ============================================================

export const DemoModeBanner: React.FC<DemoModeBannerProps> = ({
  isActive = false,
  onDismiss,
  onActivate,
  onDeactivate,
  showMetrics = true,
  autoHide = false,
  autoHideDelay = 10000
}) => {
  // ============================================================
  // 3. ESTADO
  // ============================================================

  const [active, setActive] = useState(isActive);
  const [visible, setVisible] = useState(true);
  const [metrics, setMetrics] = useState<DemoMetrics>({
    fps: 0,
    latency: 0,
    detections: 0,
    events: 0,
    memory: 0
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================
  // 4. MÉTRICAS DE DEMOSTRACIÓN
  // ============================================================

  const updateMetrics = () => {
    setMetrics({
      fps: Math.floor(Math.random() * 30) + 10,
      latency: Math.floor(Math.random() * 100) + 20,
      detections: Math.floor(Math.random() * 10),
      events: Math.floor(Math.random() * 50) + 10,
      memory: Math.floor(Math.random() * 256) + 128
    });
  };

  // ============================================================
  // 5. MANEJADORES
  // ============================================================

  const handleActivate = () => {
    setActive(true);
    if (onActivate) onActivate();
    if (autoHide) {
      scheduleHide();
    }
  };

  const handleDeactivate = () => {
    setActive(false);
    if (onDeactivate) onDeactivate();
  };

  const handleDismiss = () => {
    setVisible(false);
    if (onDismiss) onDismiss();
  };

  const scheduleHide = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false);
      if (onDismiss) onDismiss();
    }, autoHideDelay);
  };

  // ============================================================
  // 6. EFECTOS
  // ============================================================

  useEffect(() => {
    if (active && showMetrics) {
      updateMetrics();
      intervalRef.current = setInterval(updateMetrics, 2000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [active, showMetrics]);

  useEffect(() => {
    setActive(isActive);
  }, [isActive]);

  // ============================================================
  // 7. RENDER
  // ============================================================

  if (!visible) return null;

  return (
    <div className={`demo-mode-banner ${active ? 'active' : 'inactive'}`}>
      <div className="banner-content">
        {/* Icono y título */}
        <div className="banner-header">
          <span className="banner-icon">🧪</span>
          <span className="banner-title">
            {active ? 'Modo Demo Activo' : 'Modo Demo'}
          </span>
          <span className={`banner-status ${active ? 'on' : 'off'}`}>
            {active ? '🟢 EN VIVO' : '⏸️ PAUSADO'}
          </span>
        </div>

        {/* Descripción */}
        <p className="banner-description">
          {active
            ? 'El sistema está ejecutando datos simulados para demostración. Las detecciones son generadas aleatoriamente.'
            : 'Activa el modo demo para probar Sentra Core sin hardware real.'}
        </p>

        {/* Controles */}
        <div className="banner-controls">
          {!active ? (
            <button
              className="btn-activate"
              onClick={handleActivate}
              aria-label="Activar modo demo"
            >
              ▶️ Activar Demo
            </button>
          ) : (
            <button
              className="btn-deactivate"
              onClick={handleDeactivate}
              aria-label="Desactivar modo demo"
            >
              ⏹️ Detener Demo
            </button>
          )}
          <button
            className="btn-dismiss"
            onClick={handleDismiss}
            aria-label="Cerrar banner"
          >
            ✕
          </button>
        </div>

        {/* Métricas en tiempo real */}
        {active && showMetrics && (
          <div className="banner-metrics">
            <div className="metric-item">
              <span className="metric-label">FPS</span>
              <span className="metric-value">{metrics.fps}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Latencia</span>
              <span className="metric-value">{metrics.latency}ms</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Detecciones</span>
              <span className="metric-value">{metrics.detections}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Eventos</span>
              <span className="metric-value">{metrics.events}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Memoria</span>
              <span className="metric-value">{metrics.memory}MB</span>
            </div>
          </div>
        )}

        {/* Indicador de trazabilidad */}
        {active && (
          <div className="banner-footer">
            <span className="footer-icon">🔗</span>
            <span className="footer-text">
              EVOLIS trazando eventos · {metrics.events} registros
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// 8. EXPORTACIÓN POR DEFECTO
// ============================================================

export default DemoModeBanner;
