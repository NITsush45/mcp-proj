import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey, toExposedToolName, parseExposedToolName } from '../src/security/keys.js';
import { validateUpstreamUrl, isBlockedHost } from '../src/security/ssrf.js';

describe('api keys', () => {
  it('generates unique keys and validates hashes', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).not.toBe(b.key);
    expect(a.key.startsWith('urumi_')).toBe(true);
    expect(hashApiKey(a.key)).toBe(a.hash);
  });
});

describe('tool naming', () => {
  it('namespaces duplicate tool names deterministically', () => {
    expect(toExposedToolName('woocommerce', 'search')).toBe('woocommerce__search');
    expect(toExposedToolName('Notes MCP', 'search')).toBe('notes-mcp__search');
    expect(parseExposedToolName('notes-mcp__search')).toEqual({ slug: 'notes-mcp', tool: 'search' });
    expect(parseExposedToolName('no-separator')).toBeNull();
  });
});

describe('ssrf guard', () => {
  it('blocks metadata + loopback + private ranges', () => {
    expect(isBlockedHost('169.254.169.254')).toBe(true);
    expect(isBlockedHost('127.0.0.1')).toBe(true);
    expect(isBlockedHost('10.1.2.3')).toBe(true);
    expect(isBlockedHost('192.168.1.1')).toBe(true);
    expect(isBlockedHost('localhost')).toBe(true);
    expect(validateUpstreamUrl('http://169.254.169.254/').ok).toBe(false);
    expect(validateUpstreamUrl('ftp://example.com/x').ok).toBe(false);
  });
  it('allows cluster-internal + public https', () => {
    expect(validateUpstreamUrl('http://woocommerce-mcp.urumi.svc.cluster.local:8081/mcp').ok).toBe(true);
    expect(validateUpstreamUrl('https://mcp.example.com/mcp').ok).toBe(true);
  });
});
