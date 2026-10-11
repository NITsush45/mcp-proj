import { z } from 'zod';
import type { ZodTypeAny } from 'zod';

/** Minimal JSON Schema subset as served by upstream MCP servers. */
export interface JsonSchemaNode {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
  nullable?: boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  default?: unknown;
  description?: string;
  [k: string]: unknown;
}

function zodUnion(branches: ZodTypeAny[]): ZodTypeAny {
  if (branches.length === 0) return z.unknown();
  if (branches.length === 1) return branches[0];
  return z.union(branches as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]);
}

function jsonToZod(node: JsonSchemaNode | undefined): ZodTypeAny {
  if (!node || typeof node !== 'object') return z.unknown();
  if (Array.isArray(node.enum) && node.enum.length > 0) {
    const opts = node.enum.filter((v): v is string => typeof v === 'string');
    if (opts.length === node.enum.length) return z.enum(opts as [string, ...string[]]);
    return zodUnion(node.enum.map((v) => z.literal(v as never)));
  }
  if (node.const !== undefined) return z.literal(node.const as never);
  const branches = node.anyOf ?? node.oneOf;
  if (Array.isArray(branches) && branches.length > 0) {
    return zodUnion(branches.map(jsonToZod));
  }
  const type = Array.isArray(node.type) ? node.type.find((t) => t !== 'null') : node.type;
  let base: ZodTypeAny;
  switch (type) {
    case 'string': base = z.string(); break;
    case 'integer': base = z.number().int(); break;
    case 'number': base = z.number(); break;
    case 'boolean': base = z.boolean(); break;
    case 'array': base = z.array(jsonToZod(node.items)); break;
    case 'object': base = z.object(jsonSchemaToShape(node) ?? {}); break;
    case 'null': base = z.null(); break;
    default: base = z.unknown();
  }
  // Constraints — guarded so they only apply to the matching Zod type.
  if (typeof node.minLength === 'number' && base instanceof z.ZodString) base = base.min(node.minLength);
  if (typeof node.maxLength === 'number' && base instanceof z.ZodString) base = base.max(node.maxLength);
  if (typeof node.minimum === 'number' && base instanceof z.ZodNumber) base = base.min(node.minimum);
  if (typeof node.maximum === 'number' && base instanceof z.ZodNumber) base = base.max(node.maximum);
  if (node.default !== undefined) base = base.default(node.default as never);
  if (typeof node.description === 'string') base = base.describe(node.description);
  if (node.nullable === true) base = base.nullable();
  return base;
}

/**
 * Convert an upstream JSON Schema object into a Zod raw shape suitable for
 * McpServer.registerTool({ inputSchema }). The MCP SDK validates tool calls
 * against this shape and re-serializes it to JSON Schema for tools/list, so
 * clients still see the upstream contract. Returns undefined when the schema
 * has no usable properties (caller then registers without an input schema).
 */
export function jsonSchemaToShape(schema: unknown): Record<string, ZodTypeAny> | undefined {
  if (!schema || typeof schema !== 'object') return undefined;
  const node = schema as JsonSchemaNode;
  const props = node.properties;
  if (!props || typeof props !== 'object') return undefined;
  const required = new Set(Array.isArray(node.required) ? node.required : []);
  const shape: Record<string, ZodTypeAny> = {};
  for (const [key, sub] of Object.entries(props)) {
    const field = jsonToZod(sub);
    shape[key] = required.has(key) ? field : field.optional();
  }
  return Object.keys(shape).length > 0 ? shape : undefined;
}
