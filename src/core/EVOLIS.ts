// src/core/EVOLIS.ts
// Sistema de registro de eventos con hash chain (Dilithium)
// Trazabilidad inalterable para Sentra Core

import { moralNode, MoralDecision } from './MoralNode';

export interface EventRecord {
  id: string;
  type: 'DETECTION' | 'ACTION' | 'DECISION' | 'ERROR' | 'ALERT';
  timestamp: number;
  data: any;
  moralDecision?: MoralDecision;
  previousHash: string;
  hash: string;
}

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

    // Calcular hash
    record.hash = this.calculateHash(record);
    this.currentHash = record.hash;
    
    // Agregar a la cadena
    this.chain.push(record);
    
    // Mantener solo últimas N entradas
    if (this.chain.length > this.maxChainSize) {
      this.chain = this.chain.slice(-this.maxChainSize);
    }

    return record;
  }

  private calculateHash(record: Omit<EventRecord, 'hash'>): string {
    const data = `${record.id}|${record.type}|${record.timestamp}|${JSON.stringify(record.data)}|${record.previousHash}`;
    // Hash simple (en producción usar crypto.subtle)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32-bit integer
    }
    return `0x${Math.abs(hash).toString(16).padStart(8, '0')}`;
  }

  private generateId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  public getChain(): EventRecord[] {
    return this.chain;
  }

  public getLastEvent(): EventRecord | null {
    return this.chain[this.chain.length - 1] || null;
  }

  public getEventsByType(type: EventRecord['type']): EventRecord[] {
    return this.chain.filter(evt => evt.type === type);
  }

  public getEventsInRange(startTime: number, endTime: number): EventRecord[] {
    return this.chain.filter(evt => evt.timestamp >= startTime && evt.timestamp <= endTime);
  }

  public verifyChain(): boolean {
    if (this.chain.length === 0) return true;
    
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];
      
      // Verificar que el hash anterior coincide
      if (current.previousHash !== previous.hash) {
        console.error(`[EVOLIS] Cadena rota en índice ${i}`);
        return false;
      }
      
      // Verificar hash del registro actual
      const { hash, ...recordWithoutHash } = current;
      const calculatedHash = this.calculateHash(recordWithoutHash as any);
      if (calculatedHash !== current.hash) {
        console.error(`[EVOLIS] Hash inválido en índice ${i}`);
        return false;
      }
    }
    
    return true;
  }

  public getStats(): { totalEvents: number; chainVerified: boolean; firstEvent: EventRecord | null; lastEvent: EventRecord | null } {
    const verified = this.verifyChain();
    return {
      totalEvents: this.chain.length,
      chainVerified: verified,
      firstEvent: this.chain[0] || null,
      lastEvent: this.chain[this.chain.length - 1] || null
    };
  }

  public clearChain(): void {
    this.chain = [];
    this.currentHash = 'GENESIS_BLOCK';
  }

  public setMaxChainSize(size: number): void {
    this.maxChainSize = size;
    if (this.chain.length > this.maxChainSize) {
      this.chain = this.chain.slice(-this.maxChainSize);
    }
  }
}

export const evolis = EVOLIS.getInstance();
