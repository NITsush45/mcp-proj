import { webcrypto } from 'node:crypto';
// SDK 1.32 references bare `crypto` in transports; ensure it exists before any SDK import.
if (!(globalThis as { crypto?: unknown }).crypto) {
  (globalThis as { crypto: unknown }).crypto = webcrypto;
}
