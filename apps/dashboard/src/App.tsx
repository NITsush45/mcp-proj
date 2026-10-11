import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import { AuthProvider, useAuth } from './features/auth/AuthContext.js';
import { Layout } from './layouts/Layout.js';
import { LoginPage } from './pages/Login.js';
import { OverviewPage } from './pages/Overview.js';
import { ServersPage } from './pages/Servers.js';
import { TeamPage } from './pages/Team.js';
import { KeysPage } from './pages/Keys.js';
import { AuditPage } from './pages/Audit.js';
import { ChatPage } from './pages/Chat.js';
import { SettingsPage } from './pages/Settings.js';

function Guard({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="loading-screen">
      <div><div className="spinner" />Loading Urumi Gateway…</div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Guard><OverviewPage /></Guard>} />
          <Route path="/servers" element={<Guard><ServersPage /></Guard>} />
          <Route path="/team" element={<Guard><TeamPage /></Guard>} />
          <Route path="/keys" element={<Guard><KeysPage /></Guard>} />
          <Route path="/audit" element={<Guard><AuditPage /></Guard>} />
          <Route path="/chat" element={<Guard><ChatPage /></Guard>} />
          <Route path="/settings" element={<Guard><SettingsPage /></Guard>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
