/**
 * PerceptionEngine — TensorFlow.js object detection (COCO-SSD) + audio analysis.
 *
 * Loads COCO-SSD only when real mode is active. Detects objects from camera
 * stream and analyzes audio levels/keyword patterns from microphone input.
 * Generates events that flow through the hash chain + Dilithium signature.
 */

import type { DetectedObject } from '../types';

async function loadCocoSsd(): Promise<CocoSsdLib> {
  const cocoSsd = await import('@tensorflow-models/coco-ssd');
  await import('@tensorflow/tfjs');
  return cocoSsd as unknown as CocoSsdLib;
}

interface CocoSsdLib {
  load(config?: unknown): Promise<CocoDetector>;
}

interface CocoDetector {
  detect(img: HTMLVideoElement, maxBoxes?: number, minScore?: number): Promise<Array<{ class: string; score: number; bbox: [number, number, number, number] }>>;
}

let cocoModel: CocoDetector | null = null;
let modelLoading = false;
let modelLoadFailed = false;

export async function initPerceptionEngine(): Promise<void> {
  if (cocoModel || modelLoading || modelLoadFailed) return;
  modelLoading = true;
  try {
    const lib = await loadCocoSsd();
    cocoModel = await lib.load({ base: 'lite_mobilenet_v2' });
  } catch {
    modelLoadFailed = true;
    cocoModel = null;
  } finally {
    modelLoading = false;
  }
}

export function isModelLoaded(): boolean {
  return cocoModel !== null;
}

export function isModelLoadFailed(): boolean {
  return modelLoadFailed;
}

export async function detectObjects(
  video: HTMLVideoElement,
  threshold = 0.5,
): Promise<DetectedObject[]> {
  if (!cocoModel || !video.videoWidth) return [];
  try {
    const predictions = await cocoModel.detect(video, 20, threshold);
    return predictions.map((p: { class: string; score: number; bbox: [number, number, number, number] }) => ({
      class: p.class,
      score: p.score,
      bbox: [p.bbox[0], p.bbox[1], p.bbox[2], p.bbox[3]],
    }));
  } catch {
    return [];
  }
}

export interface AudioAnalysis {
  level: number;
  isSpike: boolean;
  keywordDetected: boolean;
  keyword: string | null;
}

const KEYWORD_PATTERNS: Array<{ freqRange: [number, number]; keyword: string }> = [
  { freqRange: [800, 1200], keyword: 'ayuda' },
  { freqRange: [300, 600], keyword: 'alto' },
  { freqRange: [1000, 1500], keyword: 'fuego' },
];

export function analyzeAudioFrame(
  freqData: Uint8Array,
  timeData: Uint8Array,
): AudioAnalysis {
  let sum = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / timeData.length);
  const level = Math.min(100, Math.round(rms * 200));
  const isSpike = level > 75;

  let dominantFreq = 0;
  let maxAmp = 0;
  for (let i = 0; i < freqData.length; i++) {
    if (freqData[i] > maxAmp) {
      maxAmp = freqData[i];
      dominantFreq = i;
    }
  }
  const sampleRate = 44100;
  const freqHz = (dominantFreq * sampleRate) / (freqData.length * 2);

  let keyword: string | null = null;
  if (maxAmp > 140 && isSpike) {
    for (const pattern of KEYWORD_PATTERNS) {
      if (freqHz >= pattern.freqRange[0] && freqHz <= pattern.freqRange[1]) {
        keyword = pattern.keyword;
        break;
      }
    }
  }

  return {
    level,
    isSpike,
    keywordDetected: keyword !== null,
    keyword,
  };
}

export function shouldTriggerVeto(
  objects: DetectedObject[],
  audio: AudioAnalysis | null,
): { veto: boolean; reason: string | null } {
  const lowConfidenceObjects = objects.filter(o => o.score < 0.6);
  if (lowConfidenceObjects.length > 0) {
    return {
      veto: true,
      reason: `Confianza baja en ${lowConfidenceObjects.length} objeto(s) detectado(s)`,
    };
  }
  if (audio && audio.keywordDetected) {
    return {
      veto: true,
      reason: `Palabra clave detectada: "${audio.keyword}" — requiere confirmación`,
    };
  }
  return { veto: false, reason: null };
}

export function disposePerceptionEngine(): void {
  cocoModel = null;
  modelLoading = false;
  modelLoadFailed = false;
}

export interface AmbiguityResult {
  isAmbiguous: boolean;
  confidence: number;
  pattern: string | null;
}

export interface NoiseAnalysisResult {
  confidence: number;
  isStructured: boolean;
  source: string | null;
}

export interface UncertaintyResult {
  requiresHumanVeto: boolean;
  level: number;
  factors: string[];
}

export function detectAmbiguousPattern(event: unknown): AmbiguityResult {
  const e = event as { metadata?: { confidence?: number; objectClass?: string } };
  const conf = e?.metadata?.confidence ?? 100;
  const isAmbiguous = conf < 60;
  return {
    isAmbiguous,
    confidence: conf,
    pattern: isAmbiguous ? (e?.metadata?.objectClass ?? 'unknown') : null,
  };
}

export function analyzeStructuredNoise(event: unknown): NoiseAnalysisResult {
  const e = event as { metadata?: { source?: string; audioLevel?: number } };
  const level = e?.metadata?.audioLevel ?? 0;
  return {
    confidence: level,
    isStructured: level > 70,
    source: level > 70 ? (e?.metadata?.source ?? 'audio') : null,
  };
}

export function assessUncertainty(event: unknown): UncertaintyResult {
  const e = event as { metadata?: { confidence?: number; cryptoVerified?: boolean; vetoTriggered?: boolean } };
  const conf = e?.metadata?.confidence ?? 100;
  const cryptoOk = e?.metadata?.cryptoVerified !== false;
  const factors: string[] = [];
  if (conf < 60) factors.push('low-confidence');
  if (!cryptoOk) factors.push('crypto-fail');
  return {
    requiresHumanVeto: factors.length > 0,
    level: 100 - conf,
    factors,
  };
}
