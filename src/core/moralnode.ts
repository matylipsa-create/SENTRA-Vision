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

export class MoralNode {
  private rules: MoralRule[] = [];
  private vetoEnabled: boolean = true;
  private log: MoralDecision[] = [];

  constructor() {
    this.loadDefaultRules();
  }

  private loadDefaultRules(): void {
    this.rules = [
      {
        id: 'NO_VIOLENCE',
        description: 'No detectar ni sugerir acciones violentas',
        priority: 'CRITICAL',
        check: (input) => {
          const violentKeywords = ['arma', 'golpe', 'pelea', 'violencia', 'pistola', 'cuchillo'];
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
          const sensitive = ['dni', 'passport', 'email', 'telefono', 'domicilio'];
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

    this.log.push(decision);
    return decision;
  }

  public getLog(): MoralDecision[] {
    return this.log;
  }

  public clearLog(): void {
    this.log = [];
  }

  public addRule(rule: MoralRule): void {
    this.rules.push(rule);
  }

  public setVetoEnabled(enabled: boolean): void {
    this.vetoEnabled = enabled;
  }

  public getVetoStatus(): boolean {
    return this.vetoEnabled;
  }
}

export const moralNode = new MoralNode();
