import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../features/auth/AuthContext.js';

const NAV: { to: string; label: string; icon: string }[] = [
  { to: '/', label: 'Overview', icon: '▦' },
  { to: '/servers', label: 'MCP Servers', icon: '⬡' },
  { to: '/team', label: 'Team', icon: '☺' },
  { to: '/keys', label: 'API Keys', icon: '⚿' },
  { to: '/audit', label: 'Audit Logs', icon: '≣' },
  { to: '/chat', label: 'Chat Agent', icon: '✦' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo">U</div>
          <div>
            <h1>Urumi Gateway</h1>
            <div className="sub">Team MCP control plane</div>
          </div>
        </div>
        <div className="nav-section">Menu</div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">{(user?.email ?? '?')[0]?.toUpperCase()}</div>
            <div>
              <div className="email">{user?.email}</div>
              <div className="role">{user?.role}</div>
            </div>
          </div>
          <button className="btn-ghost-dark" onClick={() => { logout(); nav('/login'); }}>Sign out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
