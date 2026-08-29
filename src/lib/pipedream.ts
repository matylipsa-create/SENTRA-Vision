// src/lib/pipedream.ts
// Integración con PipeDream para webhooks y endpoints
// Sentra Core: comunicación soberana con servicios externos (opcional)

// ============================================================
// 1. Tipos e interfaces
// ============================================================

export interface PipeDreamEndpoint {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  timeout?: number; // milisegundos
}

export interface PipeDreamResponse {
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
  headers?: Record<string, string>;
  timestamp?: number;
}

export interface PipeDreamEvent {
  id?: string;
  type: 'DETECTION' | 'ACTION' | 'DECISION' | 'ERROR' | 'ALERT' | 'HEALTH';
  timestamp: number;
  source: string;
  data: any;
  metadata?: Record<string, any>;
}

// ============================================================
// 2. Endpoints predefinidos para Sentra Core
// ============================================================

export const PIPEDREAM_ENDPOINTS = {
  // Eventos del sistema
  EVENTS: '/api/events',
  LOGS: '/api/logs',
  ALERTS: '/api/alerts',
  
  // Estado y monitoreo
  HEALTH: '/api/health',
  STATUS: '/api/status',
  METRICS: '/api/metrics',
  
  // Seguridad
  SECURITY_EVENTS: '/api/security/events',
  SECURITY_ALERTS: '/api/security/alerts',
  
  // EVOLIS
  EVOLIS_CHAIN: '/api/evolis/chain',
  EVOLIS_VERIFY: '/api/evolis/verify',
  
  // MoralNode
  MORAL_LOG: '/api/moral/log',
  MORAL_DECISION: '/api/moral/decision',
} as const;

export type PipeDreamEndpointKey = keyof typeof PIPEDREAM_ENDPOINTS;

// ============================================================
// 3. Cliente PipeDream
// ============================================================

export class PipeDreamClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;
  private retries: number;
  private retryDelay: number;

  constructor(config?: {
    baseUrl?: string;
    headers?: Record<string, string>;
    timeout?: number;
    retries?: number;
    retryDelay?: number;
  }) {
    this.baseUrl = config?.baseUrl || import.meta.env.VITE_PIPEDREAM_URL || '';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Client': 'SentraCore',
      'X-Version': '3.1.2-PROT',
      ...config?.headers,
    };
    this.timeout = config?.timeout || 10000;
    this.retries = config?.retries || 3;
    this.retryDelay = config?.retryDelay || 1000;
  }

  /**
   * Envía un evento a PipeDream
   */
  async sendEvent(event: PipeDreamEvent): Promise<PipeDreamResponse> {
    return this.send(PIPEDREAM_ENDPOINTS.EVENTS, event);
  }

  /**
   * Envía una alerta a PipeDream
   */
  async sendAlert(data: any): Promise<PipeDreamResponse> {
    return this.send(PIPEDREAM_ENDPOINTS.ALERTS, data);
  }

  /**
   * Envía un log a PipeDream
   */
  async sendLog(data: any): Promise<PipeDreamResponse> {
    return this.send(PIPEDREAM_ENDPOINTS.LOGS, data);
  }

  /**
   * Verifica el estado de PipeDream
   */
  async healthCheck(): Promise<PipeDreamResponse> {
    return this.get(PIPEDREAM_ENDPOINTS.HEALTH);
  }

  /**
   * Envía un evento de seguridad a PipeDream
   */
  async sendSecurityEvent(data: any): Promise<PipeDreamResponse> {
    return this.send(PIPEDREAM_ENDPOINTS.SECURITY_EVENTS, data);
  }

  /**
   * Envía la cadena de EVOLIS a PipeDream
   */
  async sendEvolisChain(chain: any[]): Promise<PipeDreamResponse> {
    return this.send(PIPEDREAM_ENDPOINTS.EVOLIS_CHAIN, { chain });
  }

  /**
   * Envía una decisión de MoralNode a PipeDream
   */
  async sendMoralDecision(decision: any): Promise<PipeDreamResponse> {
    return this.send(PIPEDREAM_ENDPOINTS.MORAL_DECISION, decision);
  }

  /**
   * Envía datos a un endpoint de PipeDream
   */
  async send(endpoint: string, data: any): Promise<PipeDreamResponse> {
    return this.request(endpoint, 'POST', data);
  }

  /**
   * Obtiene datos de un endpoint de PipeDream
   */
  async get(endpoint: string): Promise<PipeDreamResponse> {
    return this.request(endpoint, 'GET');
  }

  /**
   * Realiza una petición HTTP a PipeDream con reintentos
   */
  private async request(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    data?: any
  ): Promise<PipeDreamResponse> {
    const url = `${this.baseUrl}${endpoint}`;
    let lastError: string = '';

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const options: RequestInit = {
          method,
          headers: this.defaultHeaders,
          signal: controller.signal,
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
          options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        clearTimeout(timeoutId);

        const responseData = await response.json().catch(() => ({}));

        if (!response.ok) {
          return {
            success: false,
            error: responseData.error || `HTTP ${response.status}: ${response.statusText}`,
            statusCode: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            timestamp: Date.now(),
          };
        }

        return {
          success: true,
          data: responseData,
          statusCode: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          timestamp: Date.now(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        
        // Si es el último intento, retornar error
        if (attempt === this.retries) {
          return {
            success: false,
            error: lastError,
            timestamp: Date.now(),
          };
        }

        // Esperar antes de reintentar
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
      }
    }

    return {
      success: false,
      error: lastError || 'All retries failed',
      timestamp: Date.now(),
    };
  }

  /**
   * Configura el cliente con una nueva URL base
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Agrega o actualiza un header por defecto
   */
  setHeader(key: string, value: string): void {
    this.defaultHeaders[key] = value;
  }

  /**
   * Elimina un header por defecto
   */
  removeHeader(key: string): void {
    delete this.defaultHeaders[key];
  }

  /**
   * Obtiene la URL base actual
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// ============================================================
// 4. Instancia por defecto
// ============================================================

export const pipeDreamClient = new PipeDreamClient();

// ============================================================
// 5. Funciones auxiliares
// ============================================================

/**
 * Envía datos a PipeDream (función auxiliar)
 */
export async function sendToPipeDream(
  endpoint: string,
  data: any,
  config?: {
    baseUrl?: string;
    headers?: Record<string, string>;
  }
): Promise<PipeDreamResponse> {
  const client = new PipeDreamClient(config);
  return client.send(endpoint, data);
}

/**
 * Envía un evento a PipeDream (función auxiliar)
 */
export async function sendEventToPipeDream(
  event: PipeDreamEvent,
  config?: {
    baseUrl?: string;
    headers?: Record<string, string>;
  }
): Promise<PipeDreamResponse> {
  const client = new PipeDreamClient(config);
  return client.sendEvent(event);
}

/**
 * Verifica el estado de PipeDream (función auxiliar)
 */
export async function checkPipeDreamHealth(
  baseUrl?: string
): Promise<PipeDreamResponse> {
  const client = new PipeDreamClient({ baseUrl });
  return client.healthCheck();
}

// ============================================================
// 6. Tipos para uso externo
// ============================================================

export interface PipeDreamConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

// ============================================================
// 7. Exportación por defecto
// ============================================================

export default {
  PipeDreamClient,
  pipeDreamClient,
  sendToPipeDream,
  sendEventToPipeDream,
  checkPipeDreamHealth,
  PIPEDREAM_ENDPOINTS,
};
