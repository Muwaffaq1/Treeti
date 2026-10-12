import { createHash, randomBytes } from 'node:crypto';
import canonicalize from 'canonicalize';
export const canonical = (value: unknown): string => {const result=canonicalize(value);if(result===undefined)throw new Error('Value cannot be canonicalized');return result;};
export const sha256 = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
export const digest = (value: unknown): string => sha256(canonical(value));
export const invitationToken = () => randomBytes(32).toString('base64url');
