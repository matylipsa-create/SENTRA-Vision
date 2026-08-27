// src/lib/crypto.ts
// Utilidades criptográficas simples (compatible con offline-first)
// Para producción, usar crypto.subtle (SubtleCrypto)

/**
 * Hash SHA-256 simple usando SubtleCrypto (si está disponible).
 * Fallback: hash simple compatible con offline.
 */
export async function sha256(data: string): Promise<string> {
  // Intentar usar crypto.subtle (disponible en HTTPS/localhost)
  if ('crypto' in globalThis && globalThis.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
      const hashArray = Array.from(new Uint8Array(buffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (error) {
      console.warn('[crypto] Error en SHA-256, usando fallback:', error);
    }
  }

  // Fallback: hash simple
  return simpleHash(data);
}

/**
 * Hash simple (fallback para offline).
 * No es criptográficamente seguro, solo para compatibilidad.
 */
export function simpleHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32-bit integer
  }
  return `0x${Math.abs(hash).toString(16).padStart(16, '0')}`;
}

/**
 * Valida que una cadena de hashes sea válida (verificación de integridad).
 */
export function verifyHashChain(
  chain: Array<{ hash: string; previousHash: string }>,
  expectedFirstHash: string = 'GENESIS_BLOCK'
): boolean {
  if (chain.length === 0) return true;

  for (let i = 0; i < chain.length; i++) {
    const current = chain[i];
    const previous = i === 0 ? expectedFirstHash : chain[i - 1].hash;

    if (current.previousHash !== previous) {
      console.error(`[crypto] Cadena rota en índice ${i}`);
      return false;
    }
  }

  return true;
}

/**
 * Genera un UUID v4 simple (no es criptográficamente seguro).
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Codifica un objeto a base64.
 */
export function encodeBase64(data: string): string {
  try {
    return btoa(unescape(encodeURIComponent(data)));
  } catch (error) {
    console.error('[crypto] Error codificando base64:', error);
    return '';
  }
}

/**
 * Decodifica una cadena en base64.
 */
export function decodeBase64(data: string): string {
  try {
    return decodeURIComponent(escape(atob(data)));
  } catch (error) {
    console.error('[crypto] Error decodificando base64:', error);
    return '';
  }
}

/**
 * Computa un hash de integridad simple para detecciones.
 */
export function computeDetectionHash(
  objects: Array<{ class: string; score: number }>
): string {
  const payload = JSON.stringify(objects.sort((a, b) => a.class.localeCompare(b.class)));
  return simpleHash(payload);
}
