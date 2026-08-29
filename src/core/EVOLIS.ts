// src/core/EVOLIS.ts
// Sistema de registro de eventos con hash chain (Dilithium)
// Trazabilidad inalterable para Sentra Core
// Integra crypto helpers y estadísticas desglosadas

import { sha256, generateUUID, validateHashChain, getGenesisHash } from '../lib/crypto';

// ============================================================
// 1. TIPOS E INTERFACES
// ============================================================

export interface EventRecord {
  id: string;
  type: 'DETECTION' | 'ACTION' | 'DECISION' | 'ERROR' | 'ALERT' | 'HEALTH';
  timestamp: number;
  data: any;
  moralDecision?: {
    allowed: boolean;
    reason?: string;
    rulesApplied: string[];
  };
  previousHash: string;
  hash: string;
  signature?: string; // Dilithium signature (opcional)
}

export interface EVOLISStats {
  totalEvents: number;
  chainVerified: boolean;
  firstEvent: EventRecord | null;
  lastEvent: EventRecord | null;
  eventsByType: Record<string, number>;
  averageEventRate: number; // eventos por minuto
  totalTimeSpan: number; // ms entre primer y último evento
}

export interface EVOLISExportData {
  version: string;
  exportedAt: number;
  chain: EventRecord[];
  stats: EVOLISStats;
  metadata: {
    genesisHash: string;
    totalEvents: number;
    chainVerified: boolean;
  };
}

// ============================================================
// 2. CLASE PRINCIPAL
// ============================================================

export class EVOLIS {
  private static instance: EVOLIS;
  private chain: EventRecord[] = [];
  private currentHash: string = getGenesisHash();
  private maxChainSize: number = 10000;
  private isInitialized: boolean = false;
  private eventTimestamps: number[] = [];

  private constructor() {
    this.isInitialized = true;
    console.log('[EVOLIS] Inicializado con hash génesis:', this.currentHash);
  }

  public static getInstance(): EVOLIS {
    if (!EVOLIS.instance) {
      EVOLIS.instance = new EVOLIS();
    }
    return EVOLIS.instance;
  }

  // ============================================================
  // 3. REGISTRO DE EVENTOS
  // ============================================================

  public registerEvent(
    type: EventRecord['type'],
    data: any,
    moralDecision?: EventRecord['moralDecision']
  ): EventRecord {
    const id = generateUUID();
    const timestamp = Date.now();
    const previousHash = this.currentHash;

    // Preparar el payload para el hash
    const payload = {
      id,
      type,
      timestamp,
      data,
      moralDecision,
      previousHash
    };

    const record: EventRecord = {
      id,
      type,
      timestamp,
      data,
      moralDecision,
      previousHash,
      hash: sha256(JSON.stringify(payload))
    };

    // Actualizar estado
    this.currentHash = record.hash;
    this.chain.push(record);
    this.eventTimestamps.push(timestamp);

    // Mantener tamaño limitado
    if (this.chain.length > this.maxChainSize) {
      this.chain = this.chain.slice(-this.maxChainSize);
      this.eventTimestamps = this.eventTimestamps.slice(-this.maxChainSize);
    }

    // Log de evento (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[EVOLIS] Evento registrado: ${type} (${id})`);
    }

    return record;
  }

  // ============================================================
  // 4. CONSULTAS
  // ============================================================

  public getChain(): EventRecord[] {
    return [...this.chain];
  }

  public getLastEvent(): EventRecord | null {
    return this.chain.length > 0 ? this.chain[this.chain.length - 1] : null;
  }

  public getFirstEvent(): EventRecord | null {
    return this.chain.length > 0 ? this.chain[0] : null;
  }

  public getEventsByType(type: EventRecord['type']): EventRecord[] {
    return this.chain.filter(event => event.type === type);
  }

  public getEventsInRange(startTime: number, endTime: number): EventRecord[] {
    return this.chain.filter(
      event => event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  public getEventById(id: string): EventRecord | null {
    return this.chain.find(event => event.id === id) || null;
  }

  public getCurrentHash(): string {
    return this.currentHash;
  }

  public getChainLength(): number {
    return this.chain.length;
  }

  // ============================================================
  // 5. VERIFICACIÓN DE INTEGRIDAD
  // ============================================================

  public verifyChain(): boolean {
    return validateHashChain(this.chain);
  }

  public verifyEventIntegrity(event: EventRecord): boolean {
    const { hash, ...recordWithoutHash } = event;
    const calculatedHash = sha256(JSON.stringify(recordWithoutHash));
    return calculatedHash === event.hash;
  }

  // ============================================================
  // 6. ESTADÍSTICAS
  // ============================================================

  public getStats(): EVOLISStats {
    const verified = this.verifyChain();
    const eventsByType: Record<string, number> = {};

    this.chain.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    });

    const firstEvent = this.getFirstEvent();
    const lastEvent = this.getLastEvent();
    const totalTimeSpan = lastEvent && firstEvent 
      ? lastEvent.timestamp - firstEvent.timestamp 
      : 0;

    const averageEventRate = totalTimeSpan > 0 
      ? (this.chain.length / (totalTimeSpan / 60000)) // eventos por minuto
      : 0;

    return {
      totalEvents: this.chain.length,
      chainVerified: verified,
      firstEvent,
      lastEvent,
      eventsByType,
      averageEventRate: Math.round(averageEventRate * 100) / 100,
      totalTimeSpan
    };
  }

  // ============================================================
  // 7. EXPORTACIÓN E IMPORTACIÓN
  // ============================================================

  public exportChain(): EVOLISExportData {
    const stats = this.getStats();
    return {
      version: '1.0.0',
      exportedAt: Date.now(),
      chain: this.getChain(),
      stats,
      metadata: {
        genesisHash: getGenesisHash(),
        totalEvents: this.chain.length,
        chainVerified: stats.chainVerified
      }
    };
  }

  public importChain(data: EVOLISExportData): boolean {
    try {
      // Verificar que la cadena importada es válida
      const isValid = validateHashChain(data.chain);
      if (!isValid) {
        console.error('[EVOLIS] Cadena importada inválida');
        return false;
      }

      this.chain = data.chain;
      this.currentHash = this.chain.length > 0 
        ? this.chain[this.chain.length - 1].hash 
        : getGenesisHash();
      this.eventTimestamps = this.chain.map(event => event.timestamp);

      console.log(`[EVOLIS] Cadena importada: ${this.chain.length} eventos`);
      return true;
    } catch (error) {
      console.error('[EVOLIS] Error al importar cadena:', error);
      return false;
    }
  }

  // ============================================================
  // 8. GESTIÓN DE LA CADENA
  // ============================================================

  public clearChain(): void {
    this.chain = [];
    this.currentHash = getGenesisHash();
    this.eventTimestamps = [];
    console.log('[EVOLIS] Cadena limpiada');
  }

  public setMaxChainSize(size: number): void {
    this.maxChainSize = size;
    if (this.chain.length > this.maxChainSize) {
      this.chain = this.chain.slice(-this.maxChainSize);
      this.eventTimestamps = this.eventTimestamps.slice(-this.maxChainSize);
    }
  }

  public pruneChain(maxSize: number): number {
    if (this.chain.length <= maxSize) return 0;
    const removed = this.chain.length - maxSize;
    this.chain = this.chain.slice(-maxSize);
    this.eventTimestamps = this.eventTimestamps.slice(-maxSize);
    this.currentHash = this.chain.length > 0 
      ? this.chain[this.chain.length - 1].hash 
      : getGenesisHash();
    return removed;
  }

  // ============================================================
  // 9. FORMATO LEGIBLE
  // ============================================================

  public formatChainForDisplay(): string {
    return this.chain.map(event => 
      `[${new Date(event.timestamp).toISOString()}] ${event.type} | ${event.hash.slice(0, 10)}... → ${event.previousHash.slice(0, 10)}...`
    ).join('\n');
  }

  public getChainSummary(): string {
    const stats = this.getStats();
    return [
      '=== EVOLIS CHAIN SUMMARY ===',
      `Total events: ${stats.totalEvents}`,
      `Chain verified: ${stats.chainVerified ? '✅ Yes' : '❌ No'}`,
      `Genesis hash: ${getGenesisHash()}`,
      `Current hash: ${this.currentHash}`,
      `Events by type:`,
      ...Object.entries(stats.eventsByType).map(([type, count]) => `  ${type}: ${count}`),
      `Average event rate: ${stats.averageEventRate}/min`,
      `Time span: ${stats.totalTimeSpan > 0 ? `${(stats.totalTimeSpan / 60000).toFixed(1)} min` : 'N/A'}`
    ].join('\n');
  }
}

// ============================================================
// 10. INSTANCIA POR DEFECTO
// ============================================================

export const evolis = EVOLIS.getInstance();

// ============================================================
// 11. EXPORTACIÓN POR DEFECTO
// ============================================================

export default evolis;
