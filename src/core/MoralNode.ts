import { sha256 } from '../lib/crypto';

export interface MoralContext {
  source: string;
  confidence: number;
  operatorConsent: boolean;
  demo: boolean;
  metadata?: Record<string, unknown>;
}

export interface MoralEvaluation {
  approved: boolean;
  score: number;
  reasons: string[];
  vetoed: boolean;
  hash: string;
}

const DENY_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /identif(i|í)car.*(ni[ñn]o|menor|adole)/i, reason: 'identificación de menores no permitida' },
  { pattern: /estimar.*(edad|raza|etnia|religi)/i, reason: 'estimación de atributos sensibles no permitida' },
  { pattern: /comparar.*(rostro|cara|cara de)/i, reason: 'comparación biométrica no permitida sin consentimiento explícito' },
];

const WARN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /grupo|multitud|persona\s+sola/i, reason: 'conteo o agrupación de personas — requiere consentimiento' },
];

export async function evaluate(
  action: string,
  context: MoralContext,
): Promise<MoralEvaluation> {
  const reasons: string[] = [];
  let score = 100;

  if (!context.operatorConsent && !context.demo) {
    score -= 40;
    reasons.push('falta consentimiento explícito del operador');
  }

  if (context.confidence < 0.6) {
    score -= 20;
    reasons.push('confianza del sensor por debajo del umbral ético (60%)');
  }

  for (const deny of DENY_PATTERNS) {
    if (deny.pattern.test(action)) {
      score = 0;
      reasons.push(deny.reason);
      break;
    }
  }

  if (score > 0) {
    for (const warn of WARN_PATTERNS) {
      if (warn.pattern.test(action)) {
        score -= 15;
        reasons.push(warn.reason);
      }
    }
  }

  const approved = score >= 60;
  const vetoed = !approved;

  const payload = JSON.stringify({ action, context, score, approved });
  const hash = await sha256(payload);

  return { approved, score, reasons, vetoed, hash };
}

export async function shouldSpeak(
  action: string,
  context: MoralContext,
): Promise<{ allowed: boolean; message: string | null }> {
  const evaluation = await evaluate(action, context);
  if (!evaluation.approved) {
    return {
      allowed: false,
      message: evaluation.reasons[0] ?? 'acción vetada por el nodo de moral',
    };
  }
  return { allowed: true, message: null };
}

const moralNode = { evaluate, shouldSpeak };
export default moralNode;
