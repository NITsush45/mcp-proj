export function log(level: 'info' | 'warn' | 'error', msg: string, meta?: unknown) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, meta });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
export const logger = {
  info: (m: string, x?: unknown) => log('info', m, x),
  warn: (m: string, x?: unknown) => log('warn', m, x),
  error: (m: string, x?: unknown) => log('error', m, x),
};
