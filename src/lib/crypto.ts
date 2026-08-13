/**
 * Crypto module — Dilithium signature simulator + SHA-256 hash chain.
 *
 * Dilithium (post-quantum signature scheme) is not yet available in browsers.
 * This module uses ECDSA P-256 via Web Crypto as a functional stand-in,
 * producing real cryptographic signatures that can be verified.
 * The API mirrors what a true Dilithium integration would expose.
 */

const GENESIS_HASH = '0'.repeat(64);

let keyPair: CryptoKeyPair | null = null;

export function getGenesisHash(): string {
  return GENESIS_HASH;
}

export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return bufferToHex(buffer);
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export async function initDilithium(): Promise<void> {
  if (keyPair) return;
  try {
    keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
  } catch {
    keyPair = null;
  }
}

export async function dilithiumSign(data: string): Promise<string> {
  if (!keyPair) await initDilithium();
  if (!keyPair) return '0'.repeat(64);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keyPair.privateKey,
    encoder.encode(data),
  );
  return bufferToHex(signature);
}

export async function dilithiumVerify(data: string, signatureHex: string): Promise<boolean> {
  if (!keyPair) return false;
  try {
    const encoder = new TextEncoder();
    const sigBytes = hexToBytes(signatureHex);
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.publicKey,
      sigBytes as BufferSource,
      encoder.encode(data),
    );
  } catch {
    return false;
  }
}

export async function chainHash(previousHash: string, eventData: string): Promise<string> {
  return await sha256(previousHash + eventData);
}

export function buildEventString(event: {
  id: string;
  type: string;
  timestamp: number;
  lat: number;
  lng: number;
  metadata: Record<string, unknown>;
  demo: boolean;
}): string {
  return JSON.stringify({
    id: event.id,
    type: event.type,
    timestamp: event.timestamp,
    lat: event.lat,
    lng: event.lng,
    metadata: event.metadata,
    demo: event.demo,
  });
}

export interface CryptoResult {
  hash: string;
  previousHash: string;
  signature: string;
  cryptoVerified: boolean;
}

export async function signAndChain(
  event: {
    id: string;
    type: string;
    timestamp: number;
    lat: number;
    lng: number;
    metadata: Record<string, unknown>;
    demo: boolean;
  },
  previousHash: string,
): Promise<CryptoResult> {
  const eventString = buildEventString(event);
  const hash = await chainHash(previousHash, eventString);
  const signature = await dilithiumSign(hash);
  const cryptoVerified = await dilithiumVerify(hash, signature);
  return { hash, previousHash, signature, cryptoVerified };
}
