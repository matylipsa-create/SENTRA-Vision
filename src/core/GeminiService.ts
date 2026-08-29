// src/core/GeminiService.ts
// Servicio de Gemini con fallback local (mock)
// Soberanía del dato: si no hay API key, usa respuestas locales

import { TCREIInput, tcreiBridge, TCREIPrompt } from './TCREIBridge';
import { generateUUID } from '../lib/crypto';

// ============================================================
// 1. TIPOS E INTERFACES
// ============================================================

export interface GeminiResponse {
  text: string;
  isMock: boolean;
  timestamp: number;
  processingTime?: number;
  id?: string;
}

export interface GeminiConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  useMock?: boolean;
  timeout?: number;
}

export interface GeminiStatus {
  useMock: boolean;
  hasApiKey: boolean;
  model: string;
  isInitialized: boolean;
  lastError?: string;
}

// ============================================================
// 2. CLASE PRINCIPAL
// ============================================================

export class GeminiService {
  private static instance: GeminiService;
  private apiKey: string | null = null;
  private useMock: boolean = true;
  private model: string = 'gemini-1.5-flash';
  private temperature: number = 0.7;
  private maxTokens: number = 150;
  private timeout: number = 10000;
  private isInitialized: boolean = false;
  private lastError: string | null = null;
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

  // ============================================================
  // 3. GENERACIÓN DE RESPUESTAS
  // ============================================================

  public async generateResponse(input: TCREIInput): Promise<GeminiResponse> {
    const id = generateUUID();
    const startTime = performance.now();
    const prompt = tcreiBridge.generatePrompt(input);

    // Si estamos en modo mock o no hay API key
    if (this.useMock || !this.apiKey) {
      return this.mockResponse(prompt, startTime, id);
    }

    try {
      return await this.realGeminiCall(prompt, startTime, id);
    } catch (error) {
      console.error('[GeminiService] Error en llamada real, usando mock:', error);
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      return this.mockResponse(prompt, startTime, id);
    }
  }

  private async realGeminiCall(
    prompt: TCREIPrompt,
    startTime: number,
    id: string
  ): Promise<GeminiResponse> {
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

    // Timeout control
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${url}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ||
                    prompt.structuredData.shortPhrase;

      const processingTime = performance.now() - startTime;

      return {
        id,
        text,
        isMock: false,
        timestamp: Date.now(),
        processingTime
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private mockResponse(
    prompt: TCREIPrompt,
    startTime: number,
    id: string
  ): GeminiResponse {
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
      id,
      text,
      isMock: true,
      timestamp: Date.now(),
      processingTime
    };
  }

  // ============================================================
  // 4. CONFIGURACIÓN
  // ============================================================

  public setApiKey(key: string): void {
    this.apiKey = key;
    this.useMock = false;
    this.lastError = null;
    console.log('[GeminiService] API key actualizada, modo real activado');
  }

  public setConfig(config: Partial<GeminiConfig>): void {
    if (config.apiKey) {
      this.apiKey = config.apiKey;
      this.useMock = false;
      this.lastError = null;
    }
    if (config.model) this.model = config.model;
    if (config.temperature !== undefined) this.temperature = config.temperature;
    if (config.maxTokens !== undefined) this.maxTokens = config.maxTokens;
    if (config.useMock !== undefined) this.useMock = config.useMock;
    if (config.timeout !== undefined) this.timeout = config.timeout;
    console.log('[GeminiService] Configuración actualizada');
  }

  public getStatus(): GeminiStatus {
    return {
      useMock: this.useMock,
      hasApiKey: !!this.apiKey,
      model: this.model,
      isInitialized: this.isInitialized,
      lastError: this.lastError || undefined
    };
  }

  // ============================================================
  // 5. GESTIÓN DE RESPUESTAS MOCK
  // ============================================================

  public addMockResponse(response: string): void {
    this.mockResponses.push(response);
  }

  public removeMockResponse(index: number): void {
    if (index >= 0 && index < this.mockResponses.length) {
      this.mockResponses.splice(index, 1);
    }
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

  public getMockResponses(): string[] {
    return [...this.mockResponses];
  }

  // ============================================================
  // 6. FUNCIONES AUXILIARES
  // ============================================================

  public async generateContextualResponse(
    detections: Array<{ label: string; confidence: number }>,
    context?: string
  ): Promise<GeminiResponse> {
    const input: TCREIInput = {
      type: 'CONTEXT',
      detectedObjects: detections,
      context: context || 'Entorno general',
      priority: detections.some(d => ['knife', 'gun', 'weapon'].includes(d.label)) ? 'CRITICAL' : 'MEDIUM'
    };
    return this.generateResponse(input);
  }

  public async generateAlertResponse(
    message: string,
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM'
  ): Promise<GeminiResponse> {
    const input: TCREIInput = {
      type: 'ALERT',
      context: message,
      priority
    };
    return this.generateResponse(input);
  }

  // ============================================================
  // 7. RESET
  // ============================================================

  public reset(): void {
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY || null;
    this.useMock = !this.apiKey;
    this.lastError = null;
    console.log('[GeminiService] Reset completado');
  }
}

// ============================================================
// 8. INSTANCIA POR DEFECTO
// ============================================================

export const geminiService = GeminiService.getInstance();

// ============================================================
// 9. EXPORTACIÓN POR DEFECTO
// ============================================================

export default geminiService;
