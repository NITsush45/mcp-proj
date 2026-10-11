import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../features/auth/AuthContext.js';
import { IconGrid, IconStack, IconPeople, IconKey, IconScroll, IconChat, IconCog, UrumiMark } from '../components/Icons.js';

const NAV: { to: string; label: string; Icon: (p: { size?: number }) => JSX.Element }[] = [
  { to: '/', label: 'Overview', Icon: IconGrid },
  { to: '/servers', label: 'MCP Servers', Icon: IconStack },
  { to: '/team', label: 'Team', Icon: IconPeople },
  { to: '/keys', label: 'API Keys', Icon: IconKey },
  { to: '/audit', label: 'Audit Logs', Icon: IconScroll },
  { to: '/chat', label: 'Chat Agent', Icon: IconChat },
  { to: '/settings', label: 'Settings', Icon: IconCog },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo"><UrumiMark size={22} /></div>
          <div>
            <h1>Urumi Gateway</h1>
            <div className="sub">Team MCP control plane</div>
          </div>
        </div>
        <div className="nav-section">Menu</div>
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon"><Icon /></span>
            {label}
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

