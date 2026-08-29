// src/lib/index.ts
// Exportaciones centralizadas de la librería de utilidades de Sentra Core
// Facilita la importación desde otros módulos: import { ... } from '../lib';

// ============================================================
// 1. Crypto helpers
// ============================================================

export {
  // Hash
  sha256,
  sha256Secure,
  hashObject,
  hashWithTimestamp,
  isValidHash,
  
  // UUID
  generateUUID,
  
  // Hash chain
  validateHashChain,
  verifyHashChainItem,
  getGenesisHash,
  
  // Dilithium (post-quantum)
  initDilithium,
  generateDilithiumKeyPair,
  signWithDilithium,
  verifyDilithiumSignature,
  
  // Tipos
  type HashChainItem,
  type DilithiumKeyPair,
  type DilithiumSignature,
} from './crypto';

// ============================================================
// 2. PipeDream client (webhooks y endpoints)
// ============================================================

export {
  PipeDreamClient,
  sendToPipeDream,
  PIPEDREAM_ENDPOINTS,
  type PipeDreamEndpoint,
  type PipeDreamResponse,
} from './pipedream';

// ============================================================
// 3. (Futuros módulos)
// ============================================================

// export { ... } from './storage';
// export { ... } from './validation';
// export { ... } from './logger';

// ============================================================
// 4. Exportaciones por defecto
// ============================================================

// Exportar todo como objeto
import * as crypto from './crypto';
import * as pipedream from './pipedream';

export default {
  crypto,
  pipedream,
};
