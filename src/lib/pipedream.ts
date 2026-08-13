import type { SecurityEvent } from '../types';

const PIPEDREAM_KEY = 'aegis-pipedream-webhook';
const ENV_WEBHOOK_URL = (import.meta.env.VITE_PIPEDREAM_WEBHOOK_URL as string | undefined) || '';

export function getWebhookUrl(): string {
  try {
    const stored = localStorage.getItem(PIPEDREAM_KEY);
    if (stored) return stored;
  } catch { /* noop */ }
  return ENV_WEBHOOK_URL;
}

export function setWebhookUrl(url: string): void {
  try { localStorage.setItem(PIPEDREAM_KEY, url); } catch { /* noop */ }
}

export function hasWebhookConfigured(): boolean {
  return getWebhookUrl().trim().length > 0;
}

interface EventPayload {
  type: string;
  timestamp: number;
  lat: number;
  lng: number;
  hash: string;
  previousHash: string;
  signature: string;
  cryptoVerified: boolean;
  metadata: Record<string, unknown>;
  demo: boolean;
}

export async function sendEvent(event: SecurityEvent): Promise<boolean> {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    console.warn('[AEGIS] sendEvent: no webhook URL configured');
    return false;
  }

  const payload: EventPayload = {
    type: event.type,
    timestamp: event.timestamp,
    lat: event.lat,
    lng: event.lng,
    hash: event.hash,
    previousHash: event.previousHash,
    signature: event.signature,
    cryptoVerified: event.cryptoVerified,
    metadata: event.metadata,
    demo: event.demo,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[AEGIS] Telegram send failed: ${res.status} ${res.statusText}`);
      return false;
    }
    console.log(`[AEGIS] Evento enviado a Telegram: type=${event.type} hash=${event.hash.slice(0, 12)}... demo=${event.demo}`);
    return true;
  } catch (err) {
    console.error('[AEGIS] Error enviando evento a Telegram:', err);
    return false;
  }
}

/** @deprecated Use sendEvent instead — works for both demo and real events. */
export async function sendDemoEvent(event: SecurityEvent, _webhookUrl: string): Promise<boolean> {
  return sendEvent(event);
}
