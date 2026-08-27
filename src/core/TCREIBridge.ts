// src/core/TCREIBridge.ts
// Puente para generar prompts estructurados para Gemini
// Convierte datos de percepción en contexto interpretable

export interface TCREIInput {
  type: 'DETECTION' | 'CONTEXT' | 'QUESTION' | 'ALERT';
  detectedObjects?: Array<{ label: string; confidence: number; bbox?: number[] }>;
  context?: string;
  question?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userPreferences?: {
    voiceSpeed?: number;
    detailedDescription?: boolean;
    safetyPriority?: boolean;
  };
}

export interface TCREIOutput {
  prompt: string;
  structuredData: {
    action: 'DESCRIBE' | 'WARN' | 'SUGGEST' | 'CONFIRM';
    shortPhrase: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    safetyKeywords: string[];
    needsHumanVeto: boolean;
  };
}

export class TCREIBridge {
  private static instance: TCREIBridge;

  private constructor() {}

  public static getInstance(): TCREIBridge {
    if (!TCREIBridge.instance) {
      TCREIBridge.instance = new TCREIBridge();
    }
    return TCREIBridge.instance;
  }

  public generatePrompt(input: TCREIInput): TCREIOutput {
    const structuredData = this.extractStructuredData(input);
    const prompt = this.buildPrompt(input, structuredData);

    return {
      prompt,
      structuredData
    };
  }

  private extractStructuredData(input: TCREIInput): TCREIOutput['structuredData'] {
    let action: 'DESCRIBE' | 'WARN' | 'SUGGEST' | 'CONFIRM' = 'DESCRIBE';
    const safetyKeywords: string[] = [];
    let needsHumanVeto = false;
    const priority = input.priority || 'MEDIUM';

    // Determinar acción basada en el tipo y objetos detectados
    if (input.type === 'ALERT') {
      action = 'WARN';
      needsHumanVeto = true;
      safetyKeywords.push('alerta', 'precaución');
    } else if (input.detectedObjects && input.detectedObjects.length > 0) {
      const objects = input.detectedObjects.map(o => o.label);
      if (objects.some(o => ['person', 'human'].includes(o))) {
        safetyKeywords.push('persona');
        if (priority === 'HIGH' || priority === 'CRITICAL') {
          action = 'CONFIRM';
          needsHumanVeto = true;
        }
      }
      if (objects.some(o => ['car', 'vehicle', 'bicycle', 'motorcycle'].includes(o))) {
        safetyKeywords.push('vehículo', 'tráfico');
        if (priority === 'HIGH' || priority === 'CRITICAL') {
          action = 'WARN';
        }
      }
      if (objects.some(o => ['knife', 'gun', 'weapon', 'scissors'].includes(o))) {
        safetyKeywords.push('peligro', 'arma');
        action = 'WARN';
        needsHumanVeto = true;
        safetyKeywords.push('⚠️ ALERTA DE SEGURIDAD');
      }
    }

    // Generar frase corta
    let shortPhrase = this.generateShortPhrase(input, action, safetyKeywords);

    return {
      action,
      shortPhrase,
      priority,
      safetyKeywords,
      needsHumanVeto
    };
  }

  private generateShortPhrase(
    input: TCREIInput,
    action: 'DESCRIBE' | 'WARN' | 'SUGGEST' | 'CONFIRM',
    keywords: string[]
  ): string {
    if (input.type === 'QUESTION' && input.question) {
      return `Pregunta: ${input.question.substring(0, 50)}`;
    }

    if (input.type === 'ALERT') {
      return `⚠️ Alerta: ${input.context || 'Situación de atención'}`;
    }

    if (input.detectedObjects && input.detectedObjects.length > 0) {
      const topObjects = input.detectedObjects.slice(0, 3);
      const descriptions = topObjects.map(o => this.getObjectDescription(o.label));
      
      if (action === 'WARN') {
        return `⚠️ Atención: ${descriptions.join(', ')} cerca`;
      }
      if (action === 'CONFIRM') {
        return `❓ Confirmar: ¿${descriptions.join(', ')}?`;
      }
      if (descriptions.length === 1) {
        return `👁️ ${descriptions[0]}`;
      }
      if (descriptions.length === 2) {
        return `👁️ ${descriptions[0]} y ${descriptions[1]}`;
      }
      return `👁️ ${descriptions.slice(0, -1).join(', ')} y ${descriptions[descriptions.length - 1]}`;
    }

    return `📷 Analizando entorno`;
  }

  private getObjectDescription(label: string): string {
    const descriptions: Record<string, string> = {
      person: 'persona',
      car: 'automóvil',
      vehicle: 'vehículo',
      bicycle: 'bicicleta',
      motorcycle: 'motocicleta',
      bus: 'autobús',
      truck: 'camión',
      traffic: 'tráfico',
      animal: 'animal',
      dog: 'perro',
      cat: 'gato',
      chair: 'silla',
      table: 'mesa',
      bottle: 'botella',
      phone: 'teléfono',
      book: 'libro',
      tv: 'televisor',
      computer: 'computadora',
      knife: 'cuchillo',
      gun: 'arma de fuego',
      weapon: 'arma',
      scissors: 'tijeras'
    };

    return descriptions[label.toLowerCase()] || label;
  }

  private buildPrompt(input: TCREIInput, structured: TCREIOutput['structuredData']): string {
    let prompt = `[SENTRA VISIÓN - ASISTENTE DE PERCEPCIÓN]\n\n`;
    prompt += `Tipo: ${input.type}\n`;
    prompt += `Prioridad: ${structured.priority}\n`;
    prompt += `Acción: ${structured.action}\n\n`;

    if (input.detectedObjects && input.detectedObjects.length > 0) {
      prompt += `OBJETOS DETECTADOS:\n`;
      input.detectedObjects.forEach((obj, i) => {
        prompt += `  ${i + 1}. ${obj.label} (${Math.round(obj.confidence * 100)}%)\n`;
      });
      prompt += `\n`;
    }

    if (input.context) {
      prompt += `CONTEXTO: ${input.context}\n\n`;
    }

    if (input.question) {
      prompt += `PREGUNTA: ${input.question}\n\n`;
    }

    prompt += `SEGURIDAD: ${structured.safetyKeywords.join(', ') || 'Ninguna'}\n`;
    prompt += `VETO HUMANO: ${structured.needsHumanVeto ? 'REQUERIDO' : 'NO REQUERIDO'}\n`;
    prompt += `\nFRASE CORTA: ${structured.shortPhrase}`;

    return prompt;
  }

  public generateShortDescription(objects: Array<{ label: string; confidence: number }>): string {
    if (!objects || objects.length === 0) {
      return 'No se detectaron objetos';
    }

    const topObjects = objects.slice(0, 3);
    const descriptions = topObjects.map(o => this.getObjectDescription(o.label));
    
    if (descriptions.length === 1) {
      return `Ves ${descriptions[0]}`;
    }
    if (descriptions.length === 2) {
      return `Ves ${descriptions[0]} y ${descriptions[1]}`;
    }
    return `Ves ${descriptions.slice(0, -1).join(', ')} y ${descriptions[descriptions.length - 1]}`;
  }

  public generateContextualPrompt(detections: Array<{ label: string; confidence: number }>, context?: string): string {
    const input: TCREIInput = {
      type: 'CONTEXT',
      detectedObjects: detections,
      context: context || 'Entorno general',
      priority: detections.some(d => ['knife', 'gun', 'weapon'].includes(d.label)) ? 'CRITICAL' : 'MEDIUM'
    };
    return this.generatePrompt(input).prompt;
  }
}

export const tcreiBridge = TCREIBridge.getInstance();
