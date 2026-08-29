// src/core/PerceptionEngine.ts
// Motor de percepción para Sentra Core — Procesamiento de señales sensoriales
// Visión, audio, movimiento, impacto, temperatura, humedad
// Offline-first, integración con MoralNode y EVOLIS

import { moralNode } from './MoralNode';
import { evolis } from './EVOLIS';
import { tcreiBridge } from './TCREIBridge';
import { geminiService } from '../services/GeminiService';
import { generateUUID } from '../lib/crypto';

// ============================================================
// 1. TIPOS E INTERFACES
// ============================================================

export type SensorType = 
  | 'vision'
  | 'audio'
  | 'imu'
  | 'stf'
  | 'temperature'
  | 'humidity'
  | 'gps'
  | 'proximity'
  | 'motion';

export interface SensorData {
  id: string;
  type: SensorType;
  timestamp: number;
  value: any;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface DetectionEvent {
  id: string;
  type: 'OBJECT' | 'MOTION' | 'SOUND' | 'IMPACT' | 'TEMPERATURE' | 'PROXIMITY';
  label: string;
  confidence: number;
  timestamp: number;
  sensor: SensorType;
  bbox?: [number, number, number, number];
  data?: any;
}

export interface PerceptionContext {
  detections: DetectionEvent[];
  environment: {
    temperature?: number;
    humidity?: number;
    light?: number;
    noise?: number;
  };
  motion: {
    acceleration?: { x: number; y: number; z: number };
    orientation?: { alpha: number; beta: number; gamma: number };
    isMoving: boolean;
  };
  location?: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
  };
}

export interface PerceptionResult {
  events: DetectionEvent[];
  context: PerceptionContext;
  moralDecision?: {
    allowed: boolean;
    reason?: string;
    rulesApplied: string[];
  };
  evolisRecord?: any;
  processedAt: number;
}

export interface PerceptionEngineConfig {
  minConfidence: number;
  maxDetections: number;
  enableEthics: boolean;
  enableTracing: boolean;
  enableContext: boolean;
  cooldownMs: number;
  sensorTimeoutMs: number;
}

// ============================================================
// 2. CLASE PRINCIPAL
// ============================================================

export class PerceptionEngine {
  private static instance: PerceptionEngine;
  private config: PerceptionEngineConfig;
  private lastProcessed: Map<string, number> = new Map();
  private detectionHistory: DetectionEvent[] = [];
  private maxHistorySize: number = 100;
  private isInitialized: boolean = false;

  private constructor() {
    this.config = {
      minConfidence: 0.5,
      maxDetections: 10,
      enableEthics: true,
      enableTracing: true,
      enableContext: true,
      cooldownMs: 500,
      sensorTimeoutMs: 5000
    };
    this.isInitialized = true;
    console.log('[PerceptionEngine] Inicializado');
  }

  public static getInstance(): PerceptionEngine {
    if (!PerceptionEngine.instance) {
      PerceptionEngine.instance = new PerceptionEngine();
    }
    return PerceptionEngine.instance;
  }

  // ============================================================
  // 3. CONFIGURACIÓN
  // ============================================================

  public configure(config: Partial<PerceptionEngineConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[PerceptionEngine] Configuración actualizada');
  }

  public getConfig(): PerceptionEngineConfig {
    return { ...this.config };
  }

  // ============================================================
  // 4. PROCESAMIENTO DE SEÑALES
  // ============================================================

  public async processSensorData(sensorData: SensorData): Promise<PerceptionResult> {
    const startTime = Date.now();

    // Verificar cooldown
    const key = `${sensorData.type}-${sensorData.id}`;
    const lastProcess = this.lastProcessed.get(key) || 0;
    if (Date.now() - lastProcess < this.config.cooldownMs) {
      return this.createEmptyResult(startTime);
    }
    this.lastProcessed.set(key, Date.now());

    // Convertir datos del sensor en detecciones
    const detections = this.sensorToDetections(sensorData);

    // Filtrar por confianza
    const filteredDetections = detections.filter(
      d => d.confidence >= this.config.minConfidence
    );

    // Limitar número de detecciones
    const limitedDetections = filteredDetections.slice(0, this.config.maxDetections);

    // Construir contexto
    const context = this.buildContext(limitedDetections, sensorData);

    // ============================================================
    // 5. FILTRO ÉTICO (MoralNode)
    // ============================================================

    let moralDecision = null;
    let finalDetections = limitedDetections;

    if (this.config.enableEthics) {
      const evalResult = moralNode.evaluate({
        detections: limitedDetections,
        sensorType: sensorData.type,
        criticalAction: limitedDetections.some(d => 
          ['knife', 'gun', 'weapon', 'scissors'].includes(d.label)
        )
      });

      moralDecision = {
        allowed: evalResult.allowed,
        reason: evalResult.reason,
        rulesApplied: evalResult.rulesApplied
      };

      if (!evalResult.allowed) {
        // Filtrar detecciones bloqueadas
        const blockedLabels = ['knife', 'gun', 'weapon', 'scissors'];
        finalDetections = limitedDetections.filter(d => 
          !blockedLabels.includes(d.label)
        );
      }
    }

    // ============================================================
    // 6. CONTEXTO (TCREIBridge + Gemini)
    // ============================================================

    let contextualResponse = null;
    if (this.config.enableContext && finalDetections.length > 0) {
      try {
        const prompt = tcreiBridge.generatePrompt({
          type: 'CONTEXT',
          detectedObjects: finalDetections.map(d => ({
            label: d.label,
            confidence: d.confidence
          })),
          priority: finalDetections.some(d => 
            ['knife', 'gun', 'weapon'].includes(d.label)
          ) ? 'CRITICAL' : 'MEDIUM'
        });

        const response = await geminiService.generateResponse({
          type: 'CONTEXT',
          detectedObjects: finalDetections.map(d => ({
            label: d.label,
            confidence: d.confidence
          })),
          context: 'Entorno perceptivo'
        });

        contextualResponse = response;
      } catch (error) {
        console.warn('[PerceptionEngine] Error en contexto:', error);
      }
    }

    // ============================================================
    // 7. TRAZABILIDAD (EVOLIS)
    // ============================================================

    let evolisRecord = null;
    if (this.config.enableTracing && finalDetections.length > 0) {
      evolisRecord = evolis.registerEvent(
        'DETECTION',
        {
          detections: finalDetections,
          sensor: sensorData.type,
          count: finalDetections.length,
          moralDecision,
          contextualResponse: contextualResponse?.text
        },
        moralDecision || undefined
      );
    }

    // ============================================================
    // 8. HISTORIAL
    // ============================================================

    this.detectionHistory.push(...finalDetections);
    if (this.detectionHistory.length > this.maxHistorySize) {
      this.detectionHistory = this.detectionHistory.slice(-this.maxHistorySize);
    }

    // ============================================================
    // 9. RESULTADO
    // ============================================================

    return {
      events: finalDetections,
      context,
      moralDecision: moralDecision || undefined,
      evolisRecord: evolisRecord || undefined,
      processedAt: startTime
    };
  }

  // ============================================================
  // 10. CONVERSIÓN DE SENSORES A DETECCIONES
  // ============================================================

  private sensorToDetections(sensorData: SensorData): DetectionEvent[] {
    const detections: DetectionEvent[] = [];

    switch (sensorData.type) {
      case 'vision':
        if (Array.isArray(sensorData.value)) {
          // Detecciones de visión (COCO-SSD)
          for (const item of sensorData.value) {
            detections.push({
              id: generateUUID(),
              type: 'OBJECT',
              label: item.class || item.label || 'unknown',
              confidence: item.confidence || 0.8,
              timestamp: sensorData.timestamp,
              sensor: 'vision',
              bbox: item.bbox,
              data: item
            });
          }
        }
        break;

      case 'imu':
        if (sensorData.value && typeof sensorData.value === 'object') {
          const imuData = sensorData.value;
          if (imuData.acceleration) {
            detections.push({
              id: generateUUID(),
              type: 'MOTION',
              label: 'accelerometer',
              confidence: 0.9,
              timestamp: sensorData.timestamp,
              sensor: 'imu',
              data: imuData
            });
          }
        }
        break;

      case 'stf':
        if (sensorData.value && typeof sensorData.value === 'object') {
          const stfData = sensorData.value;
          detections.push({
            id: generateUUID(),
            type: 'IMPACT',
            label: 'impact_detected',
            confidence: Math.min(stfData.force / 100, 1),
            timestamp: sensorData.timestamp,
            sensor: 'stf',
            data: stfData
          });
        }
        break;

      case 'temperature':
        detections.push({
          id: generateUUID(),
          type: 'TEMPERATURE',
          label: `temp_${sensorData.value}`,
          confidence: 0.95,
          timestamp: sensorData.timestamp,
          sensor: 'temperature',
          data: { value: sensorData.value }
        });
        break;

      case 'proximity':
        if (typeof sensorData.value === 'number') {
          detections.push({
            id: generateUUID(),
            type: 'PROXIMITY',
            label: sensorData.value < 1 ? 'object_near' : 'object_far',
            confidence: 0.85,
            timestamp: sensorData.timestamp,
            sensor: 'proximity',
            data: { distance: sensorData.value }
          });
        }
        break;
    }

    return detections;
  }

  // ============================================================
  // 11. CONSTRUCCIÓN DE CONTEXTO
  // ============================================================

  private buildContext(detections: DetectionEvent[], sensorData: SensorData): PerceptionContext {
    const context: PerceptionContext = {
      detections,
      environment: {},
      motion: { isMoving: false },
      location: {}
    };

    // Extraer información del sensor
    if (sensorData.type === 'imu' && sensorData.value) {
      const imuData = sensorData.value;
      if (imuData.acceleration) {
        context.motion.acceleration = imuData.acceleration;
        context.motion.isMoving = (
          Math.abs(imuData.acceleration.x) > 0.5 ||
          Math.abs(imuData.acceleration.y) > 0.5 ||
          Math.abs(imuData.acceleration.z) > 0.5
        );
      }
      if (imuData.orientation) {
        context.motion.orientation = imuData.orientation;
      }
    }

    if (sensorData.type === 'temperature' && sensorData.value !== undefined) {
      context.environment.temperature = sensorData.value;
    }

    if (sensorData.type === 'humidity' && sensorData.value !== undefined) {
      context.environment.humidity = sensorData.value;
    }

    if (sensorData.type === 'gps' && sensorData.value) {
      context.location.latitude = sensorData.value.latitude;
      context.location.longitude = sensorData.value.longitude;
      context.location.altitude = sensorData.value.altitude;
    }

    return context;
  }

  // ============================================================
  // 12. FUNCIONES AUXILIARES
  // ============================================================

  private createEmptyResult(timestamp: number): PerceptionResult {
    return {
      events: [],
      context: {
        detections: [],
        environment: {},
        motion: { isMoving: false }
      },
      processedAt: timestamp
    };
  }

  public getHistory(): DetectionEvent[] {
    return [...this.detectionHistory];
  }

  public clearHistory(): void {
    this.detectionHistory = [];
  }

  public getLastDetections(count: number = 10): DetectionEvent[] {
    return this.detectionHistory.slice(-count);
  }

  public getStats(): {
    totalDetections: number;
    byType: Record<string, number>;
    averageConfidence: number;
  } {
    const byType: Record<string, number> = {};
    let totalConfidence = 0;

    this.detectionHistory.forEach(d => {
      byType[d.type] = (byType[d.type] || 0) + 1;
      totalConfidence += d.confidence;
    });

    return {
      totalDetections: this.detectionHistory.length,
      byType,
      averageConfidence: this.detectionHistory.length > 0 
        ? totalConfidence / this.detectionHistory.length 
        : 0
    };
  }

  public reset(): void {
    this.detectionHistory = [];
    this.lastProcessed.clear();
    console.log('[PerceptionEngine] Reset completado');
  }
}

// ============================================================
// 13. INSTANCIA POR DEFECTO
// ============================================================

export const perceptionEngine = PerceptionEngine.getInstance();

// ============================================================
// 14. EXPORTACIÓN POR DEFECTO
// ============================================================

export default perceptionEngine;
