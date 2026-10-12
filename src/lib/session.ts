import { createHmac, timingSafeEqual, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
function secret(): string {
  if (process.env.AHD_SESSION_SECRET && process.env.AHD_SESSION_SECRET.length >= 32) return process.env.AHD_SESSION_SECRET;
  if (process.env.NODE_ENV === 'production') throw new Error('Set AHD_SESSION_SECRET to a random value of at least 32 characters.');
  // A local restart invalidates demonstration cookies. Never used as production fallback.
  const g = globalThis as typeof globalThis & { ahdSecret?: string }; return g.ahdSecret ??= randomBytes(32).toString('hex');
}
export function signSession(value: unknown): string {
  const body = Buffer.from(JSON.stringify(value)).toString('base64url'); return `${body}.${createHmac('sha256', secret()).update(body).digest('base64url')}`;
}
export function readSession<T>(value?: string): T | null {
  if (!value) return null;
  try { const [body, mac] = value.split('.'); const expected = createHmac('sha256', secret()).update(body).digest(); const received = Buffer.from(mac, 'base64url'); if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null; return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T; } catch { return null; }
}
export function encryptDelivery(value: unknown) {
  const key = createHmac('sha256', secret()).update('ahd-delivery-encryption-v1').digest(), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv); const body = Buffer.concat([cipher.update(JSON.stringify(value),'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), body: body.toString('base64') };
}
export function decryptDelivery<T>(value: { iv: string; tag: string; body: string }): T {
  const key = createHmac('sha256', secret()).update('ahd-delivery-encryption-v1').digest(), cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64'));
  cipher.setAuthTag(Buffer.from(value.tag,'base64')); return JSON.parse(Buffer.concat([cipher.update(Buffer.from(value.body,'base64')),cipher.final()]).toString('utf8'));
}
