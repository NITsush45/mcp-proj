import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.js';

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('admin@urumi.local');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy || !email || !password) return;
    setErr('');
    setBusy(true);
    try { await login(email, password); nav('/'); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="logo-row">
          <div className="logo">U</div>
          <div>
            <h1>Urumi Gateway</h1>
            <p className="tagline">One MCP endpoint for your whole team</p>
          </div>
        </div>
        {err && <div className="banner error">{err}</div>}
        <label className="field" htmlFor="login-email">Email</label>
        <input
          id="login-email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@team.com"
          autoComplete="username"
        />
        <label className="field" htmlFor="login-password">Password</label>
        <input
          id="login-password"
          className="input"
          value={password}
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div style={{ marginTop: 18 }}>
          <button className="btn primary block" disabled={busy || !email || !password} onClick={submit}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
        <p className="login-hint">Demo: admin@urumi.local / ChangeMe123!</p>
      </div>
    </div>
  );
}
