// src/components/AegisMetricsPanel.tsx
// Panel de métricas del sistema — Monitoreo de Sentra Core
// Muestra estadísticas de EVOLIS, MoralNode, percepción y rendimiento

import React, { useState, useEffect, useRef } from 'react';
import { evolis } from '../core/EVOLIS';
import { moralNode } from '../core/MoralNode';
import { geminiService } from '../services/GeminiService';

// ============================================================
// 1. TIPOS E INTERFACES
// ============================================================

interface AegisMetrics {
  evolis: {
    chainLength: number;
    chainVerified: boolean;
    lastEvent: string | null;
    eventsByType: Record<string, number>;
  };
  moral: {
    totalDecisions: number;
    vetoedActions: number;
    allowedActions: number;
    lastDecision: string | null;
  };
  perception: {
    fps: number;
    detectionsPerSecond: number;
    modelLoaded: boolean;
    currentObjects: string[];
  };
  system: {
    uptime: number;
    memoryUsage: number;
    batteryLevel: number;
    networkStatus: 'online' | 'offline' | 'unknown';
  };
  gemini: {
    useMock: boolean;
    hasApiKey: boolean;
    model: string;
  };
}

interface AegisMetricsPanelProps {
  refreshInterval?: number; // ms
  onError?: (error: Error) => void;
  compact?: boolean;
}

// ============================================================
// 2. COMPONENTE PRINCIPAL
// ============================================================

export const AegisMetricsPanel: React.FC<AegisMetricsPanelProps> = ({
  refreshInterval = 5000,
  onError,
  compact = false
}) => {
  const [metrics, setMetrics] = useState<AegisMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================
  // 3. RECOLECCIÓN DE MÉTRICAS
  // ============================================================

  const collectMetrics = (): AegisMetrics => {
    const chain = evolis.getChain();
    const moralLog = moralNode.getLog();

    // Contar eventos por tipo
    const eventsByType: Record<string, number> = {};
    chain.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    });

    // Contar decisiones de MoralNode
    let vetoed = 0;
    let allowed = 0;
    moralLog.forEach(decision => {
      if (decision.allowed) {
        allowed++;
      } else {
        vetoed++;
      }
    });

    const geminiStatus = geminiService.getStatus();

    return {
      evolis: {
        chainLength: chain.length,
        chainVerified: evolis.verifyChain(),
        lastEvent: chain.length > 0 ? chain[chain.length - 1].type : null,
        eventsByType
      },
      moral: {
        totalDecisions: moralLog.length,
        vetoedActions: vetoed,
        allowedActions: allowed,
        lastDecision: moralLog.length > 0 
          ? moralLog[moralLog.length - 1].allowed ? 'Permitida' : 'Vetada'
          : null
      },
      perception: {
        fps: 0, // Se actualizará desde el hook
        detectionsPerSecond: 0,
        modelLoaded: false,
        currentObjects: []
      },
      system: {
        uptime: Math.floor(performance.now() / 1000),
        memoryUsage: 0,
        batteryLevel: 0,
        networkStatus: navigator.onLine ? 'online' : 'offline'
      },
      gemini: {
        useMock: geminiStatus.useMock,
        hasApiKey: geminiStatus.hasApiKey,
        model: geminiStatus.model
      }
    };
  };

  // ============================================================
  // 4. ACTUALIZACIÓN
  // ============================================================

  const updateMetrics = () => {
    try {
      const newMetrics = collectMetrics();
      setMetrics(newMetrics);
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al recolectar métricas';
      setError(errorMsg);
      if (onError && err instanceof Error) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // 5. EFECTOS
  // ============================================================

  useEffect(() => {
    updateMetrics();

    intervalRef.current = setInterval(updateMetrics, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshInterval]);

  // ============================================================
  // 6. RENDER
  // ============================================================

  if (isLoading) {
    return (
      <div className="aegis-metrics-panel loading">
        <div className="loading-spinner" />
        <p>Cargando métricas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="aegis-metrics-panel error">
        <span className="error-icon">⚠️</span>
        <p className="error-text">{error}</p>
        <button onClick={updateMetrics}>Reintentar</button>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="aegis-metrics-panel empty">
        <p>No hay métricas disponibles</p>
      </div>
    );
  }

  // ============================================================
  // 7. VISTA COMPACTA
  // ============================================================

  if (compact) {
    return (
      <div className="aegis-metrics-panel compact">
        <div className="metrics-grid compact">
          <div className="metric-item">
            <span className="metric-label">EVOLIS</span>
            <span className="metric-value">{metrics.evolis.chainLength}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Vetos</span>
            <span className="metric-value">{metrics.moral.vetoedActions}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Cadena</span>
            <span className={`metric-value ${metrics.evolis.chainVerified ? 'valid' : 'invalid'}`}>
              {metrics.evolis.chainVerified ? '✅' : '❌'}
            </span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Red</span>
            <span className={`metric-value ${metrics.system.networkStatus === 'online' ? 'online' : 'offline'}`}>
              {metrics.system.networkStatus === 'online' ? '📶' : '📴'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // 8. VISTA COMPLETA
  // ============================================================

  return (
    <div className="aegis-metrics-panel full">
      <div className="panel-header">
        <h2>🛡️ Sentra Core — Métricas del Sistema</h2>
        <span className="last-update">
          Actualizado: {new Date().toLocaleTimeString()}
        </span>
      </div>

      <div className="metrics-grid full">
        {/* EVOLIS */}
        <div className="metrics-section">
          <h3>🔗 EVOLIS — Trazabilidad</h3>
          <div className="metric-item">
            <span className="metric-label">Eventos registrados</span>
            <span className="metric-value">{metrics.evolis.chainLength}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Cadena verificada</span>
            <span className={`metric-value ${metrics.evolis.chainVerified ? 'valid' : 'invalid'}`}>
              {metrics.evolis.chainVerified ? '✅ Verificada' : '❌ No verificada'}
            </span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Último evento</span>
            <span className="metric-value">{metrics.evolis.lastEvent || 'Ninguno'}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Eventos por tipo</span>
            <div className="event-types">
              {Object.entries(metrics.evolis.eventsByType).map(([type, count]) => (
                <span key={type} className="event-tag">
                  {type}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* MoralNode */}
        <div className="metrics-section">
          <h3>⚖️ MoralNode — Ética</h3>
          <div className="metric-item">
            <span className="metric-label">Decisiones totales</span>
            <span className="metric-value">{metrics.moral.totalDecisions}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Acciones permitidas</span>
            <span className="metric-value allowed">{metrics.moral.allowedActions}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Acciones vetadas</span>
            <span className="metric-value vetoed">{metrics.moral.vetoedActions}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Última decisión</span>
            <span className={`metric-value ${metrics.moral.lastDecision === 'Permitida' ? 'allowed' : 'vetoed'}`}>
              {metrics.moral.lastDecision || 'Ninguna'}
            </span>
          </div>
        </div>

        {/* Gemini */}
        <div className="metrics-section">
          <h3>🧠 Gemini — IA</h3>
          <div className="metric-item">
            <span className="metric-label">Modo</span>
            <span className="metric-value">{metrics.gemini.useMock ? '📦 Mock (local)' : '☁️ Real'}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">API Key</span>
            <span className={`metric-value ${metrics.gemini.hasApiKey ? 'valid' : 'invalid'}`}>
              {metrics.gemini.hasApiKey ? '✅ Configurada' : '❌ No configurada'}
            </span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Modelo</span>
            <span className="metric-value">{metrics.gemini.model}</span>
          </div>
        </div>

        {/* Sistema */}
        <div className="metrics-section">
          <h3>💻 Sistema</h3>
          <div className="metric-item">
            <span className="metric-label">Estado de red</span>
            <span className={`metric-value ${metrics.system.networkStatus === 'online' ? 'online' : 'offline'}`}>
              {metrics.system.networkStatus === 'online' ? '📶 Conectado' : '📴 Desconectado'}
            </span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Tiempo activo</span>
            <span className="metric-value">{formatUptime(metrics.system.uptime)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 9. FUNCIONES AUXILIARES
// ============================================================

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${minutes}m ${secs}s`;
}

// ============================================================
// 10. EXPORTACIÓN POR DEFECTO
// ============================================================

export default AegisMetricsPanel;
