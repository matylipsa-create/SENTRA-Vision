import {
  detectAmbiguousPattern,
  analyzeStructuredNoise,
  assessUncertainty,
  type AmbiguityResult,
  type NoiseAnalysisResult,
  type UncertaintyResult,
} from './PerceptionEngine';

export interface EvolisAnalysis {
  ambiguity: AmbiguityResult;
  noise: NoiseAnalysisResult;
  uncertainty: UncertaintyResult;
  humanVetoRequired: boolean;
  vetoReason: string | null;
}

export type VetoHandler = (analysis: EvolisAnalysis, event: unknown) => void;

let vetoHandler: VetoHandler | null = null;

export function registerVetoHandler(handler: VetoHandler): void {
  vetoHandler = handler;
}

export function clearVetoHandler(): void {
  vetoHandler = null;
}

export function analyzeEvent(event: unknown): EvolisAnalysis {
  const ambiguity = detectAmbiguousPattern(event);
  const noise = analyzeStructuredNoise(event);
  const uncertainty = assessUncertainty(event);

  const humanVetoRequired = uncertainty.requiresHumanVeto;

  let vetoReason: string | null = null;
  if (humanVetoRequired) {
    const reasons: string[] = [];
    if (ambiguity.isAmbiguous) reasons.push('patron ambiguo detectado');
    if (ambiguity.confidence < 60) reasons.push('confianza perceptiva baja');
    if (noise.confidence > 70) reasons.push('ruido estructurado dominante');
    vetoReason = reasons.join('; ');
  }

  const analysis: EvolisAnalysis = {
    ambiguity,
    noise,
    uncertainty,
    humanVetoRequired,
    vetoReason,
  };

  if (humanVetoRequired && vetoHandler) {
    vetoHandler(analysis, event);
  }

  return analysis;
}
