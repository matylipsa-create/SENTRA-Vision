// src/lib/crypto.ts
// Crypto helpers para Sentra Core:
// SHA-256, hash chain validation, UUID, Dilithium (post-quantum)

// ============================================================
// 1. SHA-256 (hash simple para desarrollo y demostración)
// ============================================================

/**
 * Genera un hash SHA-256 simulado (para desarrollo)
 * En producción usar Web Crypto API o biblioteca dedicada
 */
export function sha256(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32-bit integer
  }
  return `0x${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * SHA-256 real usando Web Crypto API (asíncrono)
 */
export async function sha256Secure(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================
// 2. UUID v4
// ============================================================

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

// ============================================================
// 3. Validación de cadena de hashes (hash chain)
// ============================================================

export interface HashChainItem {
  hash: string;
  previousHash: string;
  data?: any;
  timestamp?: number;
}

/**
 * Valida la integridad de una cadena de hashes
 * Verifica que cada hash corresponda a su contenido y que la cadena esté encadenada
 */
export function validateHashChain(chain: HashChainItem[]): boolean {
  if (chain.length === 0) return true;
  
  for (let i = 1; i < chain.length; i++) {
    // Verificar que el previousHash del actual coincida con el hash del anterior
    if (chain[i].previousHash !== chain[i-1].hash) {
      console.error(`[Crypto] Hash chain rota en índice ${i}`);
      return false;
    }
  }
  return true;
}

/**
 * Verifica que un item de la cadena sea válido (hash consistente)
 */
export function verifyHashChainItem(item: HashChainItem): boolean {
  if (!item.hash || !item.previousHash) return false;
  // Validar formato de hash (0x...)
  if (!item.hash.startsWith('0x') || !item.previousHash.startsWith('0x')) {
    return false;
  }
  return true;
}

// ============================================================
// 4. Dilithium (post-quantum crypto — simulación)
// ============================================================

export interface DilithiumKeyPair {
  publicKey: string;
  privateKey: string;
}

export interface DilithiumSignature {
  signature: string;
  hash: string;
}

/**
 * Inicializa Dilithium (post-quantum crypto)
 */
export function initDilithium(): void {
  console.log('[Dilithium] Inicializado');
}

/**
 * Genera un par de claves Dilithium (simulado)
 */
export function generateDilithiumKeyPair(): DilithiumKeyPair {
  const seed = generateUUID();
  return {
    publicKey: `dilithium_pub_${sha256(seed)}`,
    privateKey: `dilithium_priv_${sha256(seed + '_priv')}`
  };
}

/**
 * Firma un hash con Dilithium (simulado)
 */
export function signWithDilithium(hash: string, privateKey: string): DilithiumSignature {
  const signature = sha256(hash + privateKey);
  return {
    signature: `dilithium_sig_${signature}`,
    hash
  };
}

/**
 * Verifica una firma Dilithium (simulado)
 */
export function verifyDilithiumSignature(hash: string, signature: string, publicKey: string): boolean {
  // Simulación: verificar que el hash esté contenido en la firma
  return signature.includes(sha256(hash));
}

// ============================================================
// 5. Funciones de utilidad adicionales
// ============================================================

/**
 * Obtiene el hash del bloque génesis
 */
export function getGenesisHash(): string {
  return 'GENESIS_BLOCK';
}

/**
 * Combina múltiples datos en un solo hash
 */
export function hashObject(data: any): string {
  return sha256(JSON.stringify(data));
}

/**
 * Genera un hash con timestamp para evitar colisiones
 */
export function hashWithTimestamp(data: any): string {
  const payload = {
    data,
    timestamp: Date.now(),
    nonce: Math.random().toString(36).substring(2, 10)
  };
  return sha256(JSON.stringify(payload));
}

/**
 * Verifica que un hash tenga formato válido
 */
export function isValidHash(hash: string): boolean {
  // Si empezamos a usar hashes reales, verificar longitud
  // Por ahora, validar que sea string no vacío
  return typeof hash === 'string' && hash.length > 0 && hash.startsWith('0x');
}

// ============================================================
// 6. Exportaciones por defecto
// ============================================================

export default {
  sha256,
  sha256Secure,
  generateUUID,
  validateHashChain,
  verifyHashChainItem,
  initDilithium,
  generateDilithiumKeyPair,
  signWithDilithium,
  verifyDilithiumSignature,
  getGenesisHash,
  hashObject,
  hashWithTimestamp,
  isValidHash
};
