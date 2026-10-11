export interface ApiEnvelope<T> { ok: boolean; data: T; }
export interface ApiError { ok: false; error: { code: string; message: string } }
export interface User { id: string; email: string; role: 'admin' | 'member'; }
export interface UpstreamServer {
  id: string; name: string; slug: string; url: string; enabled: boolean;
  description: string; status: 'Connected' | 'Unreachable' | 'Disabled';
  tools: { name: string; description?: string }[];
}
export interface ApiKeyMeta { id: string; name: string; prefix: string; revoked_at: string | null; created_at: string; }
export interface AuditRow { id: number; server_slug: string; tool_name: string; exposed_tool: string; outcome: 'success' | 'error'; duration_ms: number; error_summary: string | null; created_at: string; user_email: string | null; }
export interface ToolRef { exposed: string; slug: string; tool: string; description?: string; }
