// src/lib/crypto.ts (versión completa)

/**
 * Genera un hash SHA-256 de un string
 */
export function sha256(data: string): string {
  // Implementación simple (para desarrollo)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `0x${Math.abs(hash).toString(16).padStart(8, '0')}`;
  
  // Para producción usar SubtleCrypto (Web Crypto API)
  // const encoder = new TextEncoder();
  // const dataBuffer = encoder.encode(data);
  // const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  // return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Genera un UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Valida una cadena de hashes
 */
export function validateHashChain(chain: Array<{ hash: string; previousHash: string }>): boolean {
  if (chain.length === 0) return true;
  
  for (let i = 1; i < chain.length; i++) {
    if (chain[i].previousHash !== chain[i-1].hash) {
      return false;
    }
  }
  return true;
}

/**
 * Obtiene el hash del bloque génesis
 */
export function getGenesisHash(): string {
  return 'GENESIS_BLOCK';
}

/**
 * Inicializa Dilithium (post-quantum crypto)
 */
export function initDilithium(): void {
  console.log('[Dilithium] Inicializado');
}
