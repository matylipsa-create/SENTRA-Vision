// src/hooks/useRealModeSensors.ts
// Hook de detección de objetos con COCO-SSD + MoralNode (ética) + EVOLIS (trazabilidad)
// Offline-first, lazy loading, veto humano

import { useState, useEffect, useRef, useCallback } from 'react';
import { moralNode } from '../core/MoralNode';
import { evolis } from '../core/EVOLIS';
import { tcreiBridge } from '../core/TCREIBridge';
import { geminiService } from '../services/GeminiService';

interface DetectedObject {
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

interface SensorState {
  isModelLoaded: boolean;
  detections: DetectedObject[];
  filteredDetections: DetectedObject[];
  error: string | null;
  fps: number;
  isLoading: boolean;
  ethicalFilterActive: boolean;
  isVetoRequired: boolean;
  lastVetoDecision: string | null;
  chainVerified: boolean;
}

interface UseRealModeSensorsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  enabled: boolean;
  onDetection?: (detections: DetectedObject[]) => void;
  onEthicalFilter?: (detections: DetectedObject[], allowed: boolean) => void;
  maxDetections?: number;
  minConfidence?: number;
  lazyLoad?: boolean;
  enableEthics?: boolean;
  enableTracing?: boolean;
  enableContext?: boolean;
}

export function useRealModeSensors({
  videoRef,
  enabled,
  onDetection,
  onEthicalFilter,
  maxDetections = 10,
  minConfidence = 0.5,
  lazyLoad = true,
  enableEthics = true,
  enableTracing = true,
  enableContext = false
}: UseRealModeSensorsProps) {
  const [state, setState] = useState<SensorState>({
    isModelLoaded: false,
    detections: [],
    filteredDetections: [],
    error: null,
    fps: 0,
    isLoading: false,
    ethicalFilterActive: enableEthics,
    isVetoRequired: false,
    lastVetoDecision: null,
    chainVerified: true
  });

  const modelRef = useRef<any>(null);
  const animationRef = useRef<number>();
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());
  const isInitializedRef = useRef(false);
  const loadAttemptedRef = useRef(false);
  const lastDetectionCountRef = useRef(0);
  const contextBufferRef = useRef<DetectedObject[]>([]);

  // Cargar modelo desde CDN (fallback) o local
  const loadModel = useCallback(async () => {
    if (modelRef.current || loadAttemptedRef.current) return;
    
    loadAttemptedRef.current = true;
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('[useRealModeSensors] Cargando modelo COCO-SSD...');
      
      // Verificar si ya está cargado globalmente
      // @ts-ignore
      if (typeof cocoSsd !== 'undefined') {
        // @ts-ignore
        await tf.setBackend('webgl');
        // @ts-ignore
        await tf.ready();
        // @ts-ignore
        const model = await cocoSsd.load({
          base: 'lite_mobilenet_v2'
        });
        modelRef.current = model;
        setState(prev => ({
          ...prev,
          isModelLoaded: true,
          isLoading: false,
          error: null
        }));
        console.log('[useRealModeSensors] Modelo cargado desde CDN');
        return;
      }

      // Intentar importar dinámicamente
      try {
        const [cocoModule, tfModule] = await Promise.all([
          import('@tensorflow-models/coco-ssd'),
          import('@tensorflow/tfjs')
        ]);

        await tfModule.setBackend('webgl');
        await tfModule.ready();
        const model = await cocoModule.load({
          base: 'lite_mobilenet_v2'
        });
        modelRef.current = model;
        setState(prev => ({
          ...prev,
          isModelLoaded: true,
          isLoading: false,
          error: null
        }));
        console.log('[useRealModeSensors] Modelo cargado desde NPM');
      } catch (importError) {
        // Fallback: intentar cargar desde CDN con scripts
        console.warn('[useRealModeSensors] Fallback a CDN...');
        await loadModelFromCDN();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar el modelo';
      console.error('[useRealModeSensors] Error cargando modelo:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        isModelLoaded: false
      }));
      loadAttemptedRef.current = false;
    }
  }, []);

  // Cargar modelo desde CDN (fallback)
  const loadModelFromCDN = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      try {
        // Cargar TFJS
        const tfScript = document.createElement('script');
        tfScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js';
        tfScript.onload = () => {
          // Cargar COCO-SSD
          const cocoScript = document.createElement('script');
          cocoScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js';
          cocoScript.onload = async () => {
            try {
              // @ts-ignore
              await tf.setBackend('webgl');
              // @ts-ignore
              await tf.ready();
              // @ts-ignore
              const model = await cocoSsd.load({
                base: 'lite_mobilenet_v2'
              });
              modelRef.current = model;
              setState(prev => ({
                ...prev,
                isModelLoaded: true,
                isLoading: false,
                error: null
              }));
              console.log('[useRealModeSensors] Modelo cargado desde CDN (fallback)');
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          cocoScript.onerror = reject;
          document.head.appendChild(cocoScript);
        };
        tfScript.onerror = reject;
        document.head.appendChild(tfScript);
      } catch (err) {
        reject(err);
      }
    });
  }, []);

  // Detectar objetos en el video
  const detectObjects = useCallback(async () => {
    if (!videoRef.current || !modelRef.current || !enabled) return;

    try {
      const video = videoRef.current;
      if (video.readyState < 2) return;

      const detections = await modelRef.current.detect(video);
      
      // Filtrar por confianza
      let filtered = detections
        .filter((d: any) => d.score >= minConfidence)
        .slice(0, maxDetections);

      // 🔥 PASO 1: FILTRO ÉTICO (MoralNode)
      let ethicalFiltered = filtered;
      let vetoRequired = false;
      let vetoReason: string | null = null;

      if (enableEthics) {
        // Evaluar con MoralNode
        const moralDecision = moralNode.evaluate({
          detections: filtered,
          criticalAction: filtered.some((d: any) => 
            ['knife', 'gun', 'weapon', 'scissors'].includes(d.class)
          )
        });

        if (!moralDecision.allowed) {
          // Si hay veto ético, filtrar los objetos problemáticos
          const blockedClasses = ['knife', 'gun', 'weapon', 'scissors'];
          ethicalFiltered = filtered.filter((d: any) => 
            !blockedClasses.includes(d.class)
          );
          vetoRequired = true;
          vetoReason = moralDecision.reason || 'Filtro ético activado';
          
          // Registrar evento en EVOLIS
          if (enableTracing) {
            evolis.registerEvent('DECISION', {
              action: 'ETHICAL_FILTER',
              reason: moralDecision.reason,
              rulesApplied: moralDecision.rulesApplied,
              originalDetections: filtered.length,
              filteredDetections: ethicalFiltered.length
            }, moralDecision);
          }
        }

        // Notificar al callback de filtro ético
        if (onEthicalFilter) {
          onEthicalFilter(ethicalFiltered, moralDecision.allowed);
        }
      }

      // 🔥 PASO 2: REGISTRO EN EVOLIS (trazabilidad)
      if (enableTracing) {
        const hasChanged = ethicalFiltered.length !== lastDetectionCountRef.current;
        if (hasChanged || ethicalFiltered.length > 0) {
          evolis.registerEvent('DETECTION', {
            total: ethicalFiltered.length,
            objects: ethicalFiltered.map((d: any) => ({ 
              class: d.class, 
              confidence: d.score 
            })),
            vetoRequired,
            vetoReason
          });
          
          // Verificar la cadena periódicamente
          if (evolis.getChain().length % 10 === 0) {
            const verified = evolis.verifyChain();
            setState(prev => ({ ...prev, chainVerified: verified }));
          }
        }
        lastDetectionCountRef.current = ethicalFiltered.length;
      }

      // 🔥 PASO 3: CONTEXTO (TCREIBridge + Gemini)
      if (enableContext && ethicalFiltered.length > 0 && ethicalFiltered.length % 3 === 0) {
        const prompt = tcreiBridge.generatePrompt({
          type: 'CONTEXT',
          detectedObjects: ethicalFiltered.map((d: any) => ({ 
            label: d.class, 
            confidence: d.score 
          })),
          priority: ethicalFiltered.some((d: any) => 
            ['knife', 'gun', 'weapon'].includes(d.class)
          ) ? 'CRITICAL' : 'MEDIUM'
        });
        
        // Guardar en buffer para contexto
        contextBufferRef.current = ethicalFiltered;
        
        // Generar respuesta contextual (asíncrono, no bloquea)
        geminiService.generateResponse({
          type: 'CONTEXT',
          detectedObjects: ethicalFiltered.map((d: any) => ({ 
            label: d.class, 
            confidence: d.score 
          }))
        }).then(response => {
          if (response.text) {
            console.log('[useRealModeSensors] Contexto:', response.text);
          }
        }).catch(err => {
          console.warn('[useRealModeSensors] Error en contexto:', err);
        });
      }

      // Actualizar FPS
      frameCountRef.current++;
      const now = Date.now();
      if (now - lastFpsUpdateRef.current >= 1000) {
        const fps = frameCountRef.current;
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
        setState(prev => ({ ...prev, fps }));
      }

      // Actualizar estado
      setState(prev => ({
        ...prev,
        detections: filtered,
        filteredDetections: ethicalFiltered,
        isVetoRequired: vetoRequired,
        lastVetoDecision: vetoReason
      }));
      
      // Notificar detecciones (filtradas éticamente)
      if (onDetection) {
        onDetection(ethicalFiltered);
      }

    } catch (error) {
      console.error('[useRealModeSensors] Error detectando objetos:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Error en detección: ' + (error instanceof Error ? error.message : 'desconocido')
      }));
    }
  }, [videoRef, enabled, minConfidence, maxDetections, onDetection, onEthicalFilter, enableEthics, enableTracing, enableContext]);

  // Iniciar detección
  useEffect(() => {
    if (!enabled) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const initDetection = async () => {
      if (!isInitializedRef.current) {
        isInitializedRef.current = true;
        
        if (lazyLoad) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        await loadModel();
      }

      // Iniciar loop de detección
      const detectLoop = () => {
        detectObjects();
        animationRef.current = requestAnimationFrame(detectLoop);
      };

      detectLoop();
    };

    initDetection();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled, loadModel, detectObjects, lazyLoad]);

  // Verificar cadena periódicamente
  useEffect(() => {
    const interval = setInterval(() => {
      if (enableTracing && evolis.getChain().length > 0) {
        const verified = evolis.verifyChain();
        setState(prev => ({ ...prev, chainVerified: verified }));
      }
    }, 30000); // Cada 30 segundos

    return () => clearInterval(interval);
  }, [enableTracing]);

  // Limpiar recursos al desmontar
  useEffect(() => {
    return () => {
      if (modelRef.current) {
        modelRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // No limpiar EVOLIS para mantener la trazabilidad
    };
  }, []);

  // Función para obtener estadísticas de EVOLIS
  const getChainStats = useCallback(() => {
    if (!enableTracing) return null;
    return evolis.getStats();
  }, [enableTracing]);

  // Función para obtener el log de MoralNode
  const getMoralLog = useCallback(() => {
    if (!enableEthics) return [];
    return moralNode.getLog();
  }, [enableEthics]);

  // Función para forzar verificación de cadena
  const verifyChain = useCallback(() => {
    if (!enableTracing) return false;
    return evolis.verifyChain();
  }, [enableTracing]);

  return {
    ...state,
    loadModel,
    getChainStats,
    getMoralLog,
    verifyChain,
    evolis: enableTracing ? evolis : null,
    moralNode: enableEthics ? moralNode : null
  };
}
