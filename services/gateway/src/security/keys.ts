import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

/** Generate a team API key: urumi_<32 random bytes base64url>. Returns { key, hash }. */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = crypto.randomBytes(32).toString('base64url');
  const key = `urumi_${raw}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { key, hash, prefix: key.slice(0, 12) };
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

/** Deterministic namespace: <serverSlug>__<toolName>. Slugs are [a-z0-9-]. */
export function toExposedToolName(serverSlug: string, toolName: string): string {
  const s = serverSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'upstream';
  const t = toolName.trim();
  return `${s}__${t}`;
}

export function parseExposedToolName(exposed: string): { slug: string; tool: string } | null {
  const i = exposed.indexOf('__');
  if (i <= 0 || i === exposed.length - 2) return null;
  return { slug: exposed.slice(0, i), tool: exposed.slice(i + 2) };
}
