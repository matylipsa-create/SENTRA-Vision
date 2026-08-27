// src/core/EVOLIS.ts
// Sistema de registro de eventos con hash chain (Dilithium)
// Trazabilidad inalterable para Sentra Core

import { simpleHash } from '../lib/crypto';
import { MoralDecision } from './MoralNode';

export interface EventRecord {
  id: string;
  type: 'DETECTION' | 'ACTION' | 'DECISION' | 'ERROR' | 'ALERT';
  timestamp: number;
  data: any;
  moralDecision?: MoralDecision;
  previousHash: string;
  hash: string;
}

export interface EVOLISStats {
  totalEvents: number;
  chainVerified: boolean;
  firstEvent: EventRecord | null;
  lastEvent: EventRecord | null;
  typeBreakdown: Record<string, number>;
}

/**
 * EVOLIS — Sistema de hash chain para trazabilidad inalterable.
 * Singleton pattern con métodos de verificación y estadísticas.
 */
export class EVOLIS {
  private static instance: EVOLIS;
  private chain: EventRecord[] = [];
  private currentHash: string = 'GENESIS_BLOCK';
  private maxChainSize: number = 1000;

  private constructor() {}

  public static getInstance(): EVOLIS {
    if (!EVOLIS.instance) {
      EVOLIS.instance = new EVOLIS();
    }
    return EVOLIS.instance;
  }

  /**
   * Registra un evento en la cadena con hash.
   */
  public registerEvent(
    type: EventRecord['type'],
    data: any,
    moralDecision?: MoralDecision
  ): EventRecord {
    const id = this.generateId();
    const timestamp = Date.now();
    const previousHash = this.currentHash;
    
    const record: EventRecord = {
      id,
      type,
      timestamp,
      data,
      moralDecision,
      previousHash,
      hash: ''
    };

    record.hash = this.calculateHash(record);
    this.currentHash = record.hash;
    this.chain.push(record);

    if (this.chain.length > this.maxChainSize) {
      this.chain = this.chain.slice(-this.maxChainSize);
    }

    return record;
  }

  /**
   * Calcula el hash de un registro usando simpleHash.
   */
  private calculateHash(record: Omit<EventRecord, 'hash'>): string {
    const data = `${record.id}|${record.type}|${record.timestamp}|${JSON.stringify(record.data)}|${record.previousHash}`;
    return simpleHash(data);
  }

  /**
   * Genera un ID único para el evento.
   */
  private generateId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  /**
   * Retorna toda la cadena de eventos.
   */
  public getChain(): EventRecord[] {
    return [...this.chain];
  }

  /**
   * Retorna el último evento registrado.
   */
  public getLastEvent(): EventRecord | null {
    return this.chain[this.chain.length - 1] || null;
  }

  /**
   * Filtra eventos por tipo.
   */
  public getEventsByType(type: EventRecord['type']): EventRecord[] {
    return this.chain.filter(evt => evt.type === type);
  }

  /**
   * Filtra eventos en un rango de tiempo.
   */
  public getEventsInRange(startTime: number, endTime: number): EventRecord[] {
    return this.chain.filter(evt => evt.timestamp >= startTime && evt.timestamp <= endTime);
  }

  /**
   * Verifica la integridad de toda la cadena.
   */
  public verifyChain(): boolean {
    if (this.chain.length === 0) return true;
    
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];
      
      if (current.previousHash !== previous.hash) {
        console.error(`[EVOLIS] Cadena rota en índice ${i}`);
        return false;
      }
      
      const { hash, ...recordWithoutHash } = current;
      const calculatedHash = this.calculateHash(recordWithoutHash as any);
      if (calculatedHash !== current.hash) {
        console.error(`[EVOLIS] Hash inválido en índice ${i}`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Retorna estadísticas de la cadena.
   */
  public getStats(): EVOLISStats {
    const verified = this.verifyChain();
    const typeBreakdown: Record<string, number> = {};
    
    for (const event of this.chain) {
      typeBreakdown[event.type] = (typeBreakdown[event.type] || 0) + 1;
    }

    return {
      totalEvents: this.chain.length,
      chainVerified: verified,
      firstEvent: this.chain[0] || null,
      lastEvent: this.chain[this.chain.length - 1] || null,
      typeBreakdown
    };
  }

  /**
   * Limpia toda la cadena.
   */
  public clearChain(): void {
    this.chain = [];
    this.currentHash = 'GENESIS_BLOCK';
  }

  /**
   * Configura el tamaño máximo de la cadena.
   */
  public setMaxChainSize(size: number): void {
    this.maxChainSize = size;
    if (this.chain.length > this.maxChainSize) {
      this.chain = this.chain.slice(-this.maxChainSize);
    }
  }

  /**
   * Exporta la cadena en formato JSON.
   */
  public exportChain(): string {
    return JSON.stringify(this.chain);
  }

  /**
   * Importa una cadena desde JSON.
   */
  public importChain(json: string): boolean {
    try {
      this.chain = JSON.parse(json);
      if (this.chain.length > 0) {
        this.currentHash = this.chain[this.chain.length - 1].hash;
      }
      return this.verifyChain();
    } catch (error) {
      console.error('[EVOLIS] Error importando cadena:', error);
      return false;
    }
  }
}

// Exportar instancia singleton
export const evolis = EVOLIS.getInstance();
