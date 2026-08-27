// src/core/MoralNode.ts
// Módulo de filtro ético para Sentra Core
// Principios: Veto humano, Offline-first, Soberanía del dato

export interface MoralRule {
  id: string;
  description: string;
  check: (input: any) => { allowed: boolean; reason?: string };
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface MoralDecision {
  allowed: boolean;
  reason?: string;
  rulesApplied: string[];
  timestamp: number;
}

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

export class MoralNode {
  private static instance: MoralNode;
  private rules: MoralRule[] = [];
  private vetoEnabled: boolean = true;
  private log: MoralDecision[] = [];
  private maxLogSize: number = 500;

  private constructor() {
    this.loadDefaultRules();
  }

  public static getInstance(): MoralNode {
    if (!MoralNode.instance) {
      MoralNode.instance = new MoralNode();
    }
    return MoralNode.instance;
  }

  private loadDefaultRules(): void {
    this.rules = [
      {
        id: 'NO_VIOLENCE',
        description: 'No detectar ni sugerir acciones violentas',
        priority: 'CRITICAL',
        check: (input) => {
          const violentKeywords = ['arma', 'golpe', 'pelea', 'violencia', 'pistola', 'cuchillo', 'gun', 'knife', 'weapon'];
          const text = JSON.stringify(input).toLowerCase();
          const found = violentKeywords.filter(k => text.includes(k));
          if (found.length > 0) {
            return { allowed: false, reason: `Contenido violento detectado: ${found.join(', ')}` };
          }
          return { allowed: true };
        }
      },
      {
        id: 'PRIVACY_FIRST',
        description: 'No almacenar datos sensibles sin consentimiento',
        priority: 'HIGH',
        check: (input) => {
          const sensitive = ['dni', 'passport', 'email', 'telefono', 'domicilio', 'address', 'ssn'];
          const text = JSON.stringify(input).toLowerCase();
          const found = sensitive.filter(k => text.includes(k));
          if (found.length > 0) {
            return { allowed: false, reason: `Datos sensibles detectados: ${found.join(', ')}` };
          }
          return { allowed: true };
        }
      },
      {
        id: 'OFFLINE_ONLY',
        description: 'No enviar datos fuera del dispositivo sin consentimiento',
        priority: 'HIGH',
        check: (input) => {
          if (input.externalRequest && !input.consentGiven) {
            return { allowed: false, reason: 'Intento de envio de datos externo sin consentimiento' };
          }
          return { allowed: true };
        }
      },
      {
        id: 'HUMAN_VETO',
        description: 'Toda acción crítica requiere confirmación humana',
        priority: 'CRITICAL',
        check: (input) => {
          if (input.criticalAction && !input.vetoConfirmed) {
            return { allowed: false, reason: 'Acción crítica sin veto humano confirmado' };
          }
          return { allowed: true };
        }
      }
    ];
  }

  /**
   * Evalúa si una acción cumple con las reglas morales.
   * Compatible con useRealModeSensors y otros módulos.
   */
  public evaluate(input: any): MoralDecision {
    const rulesApplied: string[] = [];
    let allowed = true;
    let reason: string | undefined;

    for (const rule of this.rules) {
      const result = rule.check(input);
      rulesApplied.push(rule.id);
      
      if (!result.allowed) {
        allowed = false;
        reason = result.reason || `Regla violada: ${rule.id}`;
        break;
      }
    }

    const decision: MoralDecision = {
      allowed,
      reason,
      rulesApplied,
      timestamp: Date.now()
    };

    // Mantener el log dentro del límite
    this.log.push(decision);
    if (this.log.length > this.maxLogSize) {
      this.log = this.log.slice(-this.maxLogSize);
    }

    return decision;
  }

  /**
   * Evalúa una acción con contexto ético detallado.
   */
  public async evaluateWithContext(
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

    // Evaluar con reglas morales
    const moralDecision = this.evaluate({
      action,
      context,
      score
    });

    if (!moralDecision.allowed) {
      score = 0;
      if (moralDecision.reason) {
        reasons.push(moralDecision.reason);
      }
    }

    const approved = score >= 60;
    const vetoed = !approved;
    const payload = JSON.stringify({ action, context, score, approved });
    const hash = this.simpleHash(payload);

    return { approved, score, reasons, vetoed, hash };
  }

  /**
   * Hash simple para compatibilidad (en producción usar crypto.subtle).
   */
  private simpleHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32-bit integer
    }
    return `0x${Math.abs(hash).toString(16).padStart(8, '0')}`;
  }

  /**
   * Retorna el log de decisiones morales.
   */
  public getLog(): MoralDecision[] {
    return [...this.log];
  }

  /**
   * Limpia el log de decisiones.
   */
  public clearLog(): void {
    this.log = [];
  }

  /**
   * Agrega una regla moral personalizada.
   */
  public addRule(rule: MoralRule): void {
    this.rules.push(rule);
  }

  /**
   * Habilita o deshabilita el veto humano.
   */
  public setVetoEnabled(enabled: boolean): void {
    this.vetoEnabled = enabled;
  }

  /**
   * Retorna el estado del veto humano.
   */
  public getVetoStatus(): boolean {
    return this.vetoEnabled;
  }

  /**
   * Retorna las reglas morales activas.
   */
  public getRules(): MoralRule[] {
    return [...this.rules];
  }
}

// Exportar instancia singleton
export const moralNode = MoralNode.getInstance();
export default moralNode;
