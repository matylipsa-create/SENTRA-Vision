// src/services/VoiceManager.ts
// Gestor de síntesis de voz con cola y deduplicación
// Accesibilidad para ciegos y baja visión (TalkBack, NVDA)

export interface VoiceOptions {
  text: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  lang?: string;
  skipIfSpeaking?: boolean;
}

export interface VoiceQueueItem {
  id: string;
  options: VoiceOptions;
  timestamp: number;
  priority: number;
  attempted: boolean;
}

export interface VoiceManagerConfig {
  maxQueueSize?: number;
  deduplicateWindow?: number; // en ms
  autoPlay?: boolean;
  defaultRate?: number;
  defaultPitch?: number;
  defaultVolume?: number;
}

export class VoiceManager {
  private static instance: VoiceManager;
  private queue: VoiceQueueItem[] = [];
  private isSpeaking: boolean = false;
  private lastSpokenText: string = '';
  private lastSpokenTime: number = 0;
  private deduplicateWindow: number = 2000; // ms
  private maxQueueSize: number = 50;
  private autoPlay: boolean = true;
  private defaultRate: number = 1;
  private defaultPitch: number = 1;
  private defaultVolume: number = 1;
  private stats = {
    totalSpoken: 0,
    queuedItems: 0,
    deduplicated: 0,
    errors: 0
  };

  private constructor(config?: VoiceManagerConfig) {
    if (config?.maxQueueSize) this.maxQueueSize = config.maxQueueSize;
    if (config?.deduplicateWindow) this.deduplicateWindow = config.deduplicateWindow;
    if (config?.autoPlay !== undefined) this.autoPlay = config.autoPlay;
    if (config?.defaultRate) this.defaultRate = config.defaultRate;
    if (config?.defaultPitch) this.defaultPitch = config.defaultPitch;
    if (config?.defaultVolume) this.defaultVolume = config.defaultVolume;

    this.setupSpeechSynthesis();
  }

  public static getInstance(config?: VoiceManagerConfig): VoiceManager {
    if (!VoiceManager.instance) {
      VoiceManager.instance = new VoiceManager(config);
    }
    return VoiceManager.instance;
  }

  private setupSpeechSynthesis(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onend = () => {
        this.isSpeaking = false;
        if (this.autoPlay && this.queue.length > 0) {
          this.processQueue();
        }
      };
    }
  }

  /**
   * Añade texto a la cola de voz.
   * Si skipIfSpeaking es true y ya se está hablando, se ignora.
   * Si es un duplicado reciente, se deduplica.
   */
  public speak(options: VoiceOptions): string {
    // Validar que la API esté disponible
    if (!('speechSynthesis' in window)) {
      console.warn('[VoiceManager] Web Speech API no disponible');
      return '';
    }

    // Deduplicar si es el mismo texto hace poco
    if (this.shouldDeduplicate(options.text)) {
      this.stats.deduplicated++;
      console.log(`[VoiceManager] Texto deduplicado: "${options.text.substring(0, 30)}..."`);
      return '';
    }

    // Si skipIfSpeaking y ya está hablando, ignorar
    if (options.skipIfSpeaking && this.isSpeaking) {
      console.log(`[VoiceManager] Ignorado por skipIfSpeaking`);
      return '';
    }

    // Crear item en cola
    const id = this.generateId();
    const priority = this.getPriority(options.priority || 'NORMAL');
    const item: VoiceQueueItem = {
      id,
      options,
      timestamp: Date.now(),
      priority,
      attempted: false
    };

    // Verificar límite de cola
    if (this.queue.length >= this.maxQueueSize) {
      console.warn(`[VoiceManager] Cola llena (${this.maxQueueSize} items), descartando el más antiguo`);
      this.queue.shift();
    }

    // Insertar en la cola respetando prioridad
    this.queue.push(item);
    this.queue.sort((a, b) => b.priority - a.priority);

    this.stats.queuedItems++;

    // Procesar cola si autoPlay está activado
    if (this.autoPlay) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Procesa la siguiente item en la cola.
   */
  private processQueue(): void {
    if (this.queue.length === 0 || this.isSpeaking) return;

    const item = this.queue.shift();
    if (!item) return;

    try {
      this.speakNow(item.options);
      this.lastSpokenText = item.options.text;
      this.lastSpokenTime = Date.now();
      this.stats.totalSpoken++;
    } catch (error) {
      console.error('[VoiceManager] Error al hablar:', error);
      this.stats.errors++;
    }
  }

  /**
   * Reproduce el texto inmediatamente (sin cola).
   */
  private speakNow(options: VoiceOptions): void {
    if (!('speechSynthesis' in window)) {
      throw new Error('Web Speech API no disponible');
    }

    this.isSpeaking = true;

    const utterance = new SpeechSynthesisUtterance(options.text);
    utterance.rate = options.rate || this.defaultRate;
    utterance.pitch = options.pitch || this.defaultPitch;
    utterance.volume = options.volume || this.defaultVolume;
    utterance.lang = options.lang || 'es-ES';

    // Cancelar cualquier discurso anterior
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  /**
   * Verifica si el texto debe deduplicarse.
   */
  private shouldDeduplicate(text: string): boolean {
    if (text === this.lastSpokenText) {
      const timeSinceLastSpoken = Date.now() - this.lastSpokenTime;
      return timeSinceLastSpoken < this.deduplicateWindow;
    }
    return false;
  }

  /**
   * Convierte prioridad a valor numérico.
   */
  private getPriority(level: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'): number {
    const priorities: Record<string, number> = {
      'LOW': 1,
      'NORMAL': 2,
      'HIGH': 3,
      'CRITICAL': 4
    };
    return priorities[level] || 2;
  }

  /**
   * Genera un ID único.
   */
  private generateId(): string {
    return `voice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  /**
   * Detiene el habla actual y limpia la cola.
   */
  public stop(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.queue = [];
  }

  /**
   * Pausa el habla actual.
   */
  public pause(): void {
    if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
    }
  }

  /**
   * Reanuda el habla.
   */
  public resume(): void {
    if ('speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }

  /**
   * Retorna el tamaño actual de la cola.
   */
  public getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Retorna si está hablando actualmente.
   */
  public isSpeakingNow(): boolean {
    return this.isSpeaking;
  }

  /**
   * Retorna las estadísticas de uso.
   */
  public getStats() {
    return {
      ...this.stats,
      currentQueueSize: this.queue.length,
      isSpeaking: this.isSpeaking
    };
  }

  /**
   * Limpia las estadísticas.
   */
  public clearStats(): void {
    this.stats = {
      totalSpoken: 0,
      queuedItems: 0,
      deduplicated: 0,
      errors: 0
    };
  }

  /**
   * Configura parámetros globales.
   */
  public setConfig(config: Partial<VoiceManagerConfig>): void {
    if (config.maxQueueSize) this.maxQueueSize = config.maxQueueSize;
    if (config.deduplicateWindow) this.deduplicateWindow = config.deduplicateWindow;
    if (config.autoPlay !== undefined) this.autoPlay = config.autoPlay;
    if (config.defaultRate) this.defaultRate = config.defaultRate;
    if (config.defaultPitch) this.defaultPitch = config.defaultPitch;
    if (config.defaultVolume) this.defaultVolume = config.defaultVolume;
  }

  /**
   * Retorna el estado actual del servicio.
   */
  public getStatus() {
    return {
      apiAvailable: 'speechSynthesis' in window,
      isSpeaking: this.isSpeaking,
      queueSize: this.queue.length,
      maxQueueSize: this.maxQueueSize,
      autoPlay: this.autoPlay,
      stats: this.getStats()
    };
  }
}

// Exportar instancia singleton
export const voiceManager = VoiceManager.getInstance();
export default voiceManager;
