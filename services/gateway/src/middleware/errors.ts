import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(JSON.stringify({ level: 'error', msg: 'unhandled', err: String(err) }));
  // Never leak internals / credentials
  res.status(500).json({ ok: false, error: { code: 'INTERNAL', message: 'Something went wrong' } });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
}
