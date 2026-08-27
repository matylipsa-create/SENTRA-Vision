// src/services/GeminiService.ts
// Servicio de Gemini con fallback local (mock)
// Soberanía del dato: si no hay API key, usa respuestas locales

import { TCREIInput, TCREIOutput, tcreiBridge } from '../core/TCREIBridge';

interface GeminiResponse {
  text: string;
  isMock: boolean;
  timestamp: number;
  processingTime?: number;
}

interface GeminiConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  useMock?: boolean;
}

export class GeminiService {
  private static instance: GeminiService;
  private apiKey: string | null = null;
  private useMock: boolean = true;
  private model: string = 'gemini-1.5-flash';
  private temperature: number = 0.7;
  private maxTokens: number = 150;
  private isInitialized: boolean = false;
  
  // Respuestas de fallback local (soberanía del dato)
  private mockResponses: string[] = [
    'Entendido. El entorno parece seguro.',
    'He analizado la escena. No hay peligros inmediatos.',
    'Información procesada. Todo en orden.',
    'Confirmo la detección. No se requieren acciones adicionales.',
    'Entorno verificado. Puedes continuar.',
    'Percepción completada. Sin novedades.',
    'Análisis de entorno finalizado. Zona segura.',
    'Detección confirmada. Sin alertas pendientes.'
  ];

  private constructor() {
    // Intentar cargar API key del entorno
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY || null;
    if (this.apiKey) {
      this.useMock = false;
      console.log('[GeminiService] API key cargada, modo real activado');
    } else {
      console.log('[GeminiService] No se encontró API key, usando modo mock local (soberanía del dato)');
    }
    this.isInitialized = true;
  }

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  public async generateResponse(input: TCREIInput): Promise<GeminiResponse> {
    const startTime = performance.now();
    const prompt = tcreiBridge.generatePrompt(input);

    if (this.useMock || !this.apiKey) {
      return this.mockResponse(prompt, startTime);
    }

    try {
      return await this.realGeminiCall(prompt, startTime);
    } catch (error) {
      console.error('[GeminiService] Error en llamada real, usando mock:', error);
      return this.mockResponse(prompt, startTime);
    }
  }

  private async realGeminiCall(prompt: TCREIOutput, startTime: number): Promise<GeminiResponse> {
    if (!this.apiKey) {
      throw new Error('API key no configurada');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt.prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: this.temperature,
        maxOutputTokens: this.maxTokens,
        topP: 0.9,
        topK: 40
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        }
      ]
    };

    const response = await fetch(`${url}?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                  prompt.structuredData.shortPhrase;

    const processingTime = performance.now() - startTime;

    return {
      text,
      isMock: false,
      timestamp: Date.now(),
      processingTime
    };
  }

  private mockResponse(prompt: TCREIOutput, startTime: number): GeminiResponse {
    // Seleccionar respuesta aleatoria de las locales
    const randomIndex = Math.floor(Math.random() * this.mockResponses.length);
    let text = this.mockResponses[randomIndex];
    
    // Si hay una frase corta en el prompt, usarla como complemento
    if (prompt.structuredData.shortPhrase) {
      text = `${text} ${prompt.structuredData.shortPhrase}`;
    }

    // Si hay alerta de seguridad, agregar énfasis
    if (prompt.structuredData.safetyKeywords.length > 0) {
      text = `⚠️ ${text}`;
    }

    // Si requiere veto humano, agregar advertencia
    if (prompt.structuredData.needsHumanVeto) {
      text = `${text} 🔒 Requiere confirmación humana.`;
    }

    const processingTime = performance.now() - startTime;

    return {
      text,
      isMock: true,
      timestamp: Date.now(),
      processingTime
    };
  }

  public setApiKey(key: string): void {
    this.apiKey = key;
    this.useMock = false;
    console.log('[GeminiService] API key actualizada, modo real activado');
  }

  public setConfig(config: Partial<GeminiConfig>): void {
    if (config.apiKey) {
      this.apiKey = config.apiKey;
      this.useMock = false;
    }
    if (config.model) this.model = config.model;
    if (config.temperature !== undefined) this.temperature = config.temperature;
    if (config.maxTokens !== undefined) this.maxTokens = config.maxTokens;
    if (config.useMock !== undefined) this.useMock = config.useMock;
  }

  public getStatus(): { 
    useMock: boolean; 
    hasApiKey: boolean; 
    model: string;
    isInitialized: boolean;
  } {
    return {
      useMock: this.useMock,
      hasApiKey: !!this.apiKey,
      model: this.model,
      isInitialized: this.isInitialized
    };
  }

  public addMockResponse(response: string): void {
    this.mockResponses.push(response);
  }

  public clearMockResponses(): void {
    this.mockResponses = [];
  }

  public resetMockResponses(): void {
    this.mockResponses = [
      'Entendido. El entorno parece seguro.',
      'He analizado la escena. No hay peligros inmediatos.',
      'Información procesada. Todo en orden.',
      'Confirmo la detección. No se requieren acciones adicionales.',
      'Entorno verificado. Puedes continuar.',
      'Percepción completada. Sin novedades.',
      'Análisis de entorno finalizado. Zona segura.',
      'Detección confirmada. Sin alertas pendientes.'
    ];
  }
}

export const geminiService = GeminiService.getInstance();
