import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { User } from '../types/index.js';

export function TeamPage() {
  const [members, setMembers] = useState<User[]>([]);
  const [form, setForm] = useState({ email: '', password: '', role: 'member' });
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = () => api.members().then(setMembers).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  useEffect(() => { refresh(); }, []);
  const invite = async () => {
    if (!form.email.trim() || form.password.length < 8 || busy) {
      setErr('Email and a password of at least 8 characters are required.');
      return;
    }
    setBusy(true); setErr(''); setNotice('');
    try {
      await api.addMember(form);
      setNotice(`${form.email} added as ${form.role}.`);
      setForm({ email: '', password: '', role: 'member' });
      refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Team</h2>
          <div className="subtitle">Members who can log in and mint API keys</div>
        </div>
      </div>
      {err && <div className="banner error">{err}</div>}
      {notice && <div className="banner success">{notice}</div>}

      <div className="card">
        <h3>Invite member</h3>
        <div className="form-grid">
          <div>
            <label className="field" htmlFor="tm-email">Email</label>
            <input id="tm-email" className="input" placeholder="teammate@team.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="field" htmlFor="tm-pw">Temporary password (min 8)</label>
            <input id="tm-pw" className="input" type="password" placeholder="••••••••" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="field" htmlFor="tm-role">Role</label>
            <select id="tm-role" className="input" value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="member">member — keys + chat</option>
              <option value="admin">admin — full control</option>
            </select>
          </div>
          <button className="btn primary" disabled={busy} onClick={invite}>{busy ? 'Adding…' : 'Add member'}</button>
        </div>
      </div>

      <div className="card">
        <h3>Members ({members.length})</h3>
        {members.length === 0 ? (
          <div className="empty"><div className="icon">☺</div>No members loaded.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Email</th><th>Role</th></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.email}</td>
                    <td><span className={`badge ${m.role === 'admin' ? 'indigo' : 'gray'}`}>{m.role}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
