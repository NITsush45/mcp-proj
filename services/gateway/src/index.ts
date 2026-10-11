import { webcrypto } from 'node:crypto';
if (!(globalThis as { crypto?: unknown }).crypto) {
  (globalThis as { crypto: unknown }).crypto = webcrypto;
}
import { createApp } from './app.js';

const { app, env } = createApp();

const server = app.listen(env.PORT, () => {
  console.log(JSON.stringify({ level: 'info', msg: `gateway listening on :${env.PORT}` }));
});

function shutdown(sig: string) {
  console.log(JSON.stringify({ level: 'info', msg: `received ${sig}, closing` }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// An async route error must never take the gateway down (log + keep serving).
process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({ level: 'error', msg: 'unhandledRejection', err: String(reason).slice(0, 500) }));
});
