import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().default('postgres://urumi:urumi_dev@localhost:5432/urumi_gateway'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be >= 32 chars'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@urumi.local'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('ChangeMe123!'),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().default(8000),
  UPSTREAM_DISCOVERY_TIMEOUT_MS: z.coerce.number().default(5000),
  MCP_ROUTE_PREFIX: z.string().default('/mcp'),
  LLM_PROVIDER: z.string().default('openai'),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  LLM_API_KEY: z.string().default(''),
  LLM_BASE_URL: z.string().default(''),
  CHAT_MAX_ITERATIONS: z.coerce.number().default(6),
  CHAT_MAX_MESSAGE_CHARS: z.coerce.number().default(4000),
  NODE_ENV: z.string().default('development'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  return parsed.data;
}
