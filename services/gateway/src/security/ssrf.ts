export function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().trim().replace(/\.$/, '');
  if (['localhost', 'metadata.google.internal'].includes(h)) return true;
  if (h === '169.254.169.254') return true; // cloud metadata
  if (h === '[::1]' || h === '::1') return true;
  if (/^127\./.test(h)) return true;             // loopback v4
  if (/^10\./.test(h)) return true;              // RFC1918
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^0\.0\.0\.0$/.test(h)) return true;
  // NOTE: in-cluster DNS names (*.svc, *.svc.cluster.local) are ALLOWED —
  // upstreams run as internal K8s Services. Public-internet metadata is blocked above.
  return false;
}

/** Validate an admin-supplied upstream URL (SSRF guard, phase 2 basic version). */
export function validateUpstreamUrl(raw: string): { ok: boolean; reason?: string; url?: URL } {
  let u: URL;
  try { u = new URL(raw); }
  catch { return { ok: false, reason: 'Invalid URL' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, reason: 'Only http(s) allowed' };
  if (u.username || u.password) return { ok: false, reason: 'Credentials in URL are not allowed' };
  if (isBlockedHost(u.hostname)) return { ok: false, reason: `Host '${u.hostname}' is not allowed` };
  return { ok: true, url: u };
}
