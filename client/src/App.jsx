import { NavLink, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard.jsx';
import Register from './pages/Register.jsx';
import TakeAttendance from './pages/TakeAttendance.jsx';
import Records from './pages/Records.jsx';
import Students from './pages/Students.jsx';
import Evaluate from './pages/Evaluate.jsx';
import { api } from './lib/api.js';

const links = [
  { to: '/', label: 'Dashboard', icon: '▦' },
  { to: '/attendance', label: 'Take Attendance', icon: '◉' },
  { to: '/register', label: 'Register Student', icon: '＋' },
  { to: '/students', label: 'Students', icon: '☰' },
  { to: '/records', label: 'Attendance Records', icon: '▤' },
  { to: '/evaluate', label: 'Model Evaluation', icon: '◎' },
];

export default function App() {
  const [health, setHealth] = useState(null);
  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);
  const srv = health?.server;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">
            <img src="/logo.png" alt="FaceTrack logo" />
          </div>
          <div>
            <div className="brand-name">FaceTrack</div>
            <div className="brand-sub">AI Attendance System</div>
          </div>
        </div>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="nav-icon">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="server-card">
          <div className="server-title">Cloud server</div>
          {srv ? (
            <>
              <div className="server-row">
                <span className={`dot ${health.database === 'connected' ? 'ok' : 'bad'}`} />
                {srv.platform}
              </div>
              {srv.instanceId && <div className="server-meta">{srv.instanceId}</div>}
              {srv.availabilityZone && (
                <div className="server-meta">
                  {srv.instanceType} · {srv.availabilityZone}
                </div>
              )}
              <div className="server-meta">Storage: {health.storage?.type}</div>
            </>
          ) : (
            <div className="server-meta">Connecting…</div>
          )}
        </div>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard health={health} />} />
          <Route path="/attendance" element={<TakeAttendance />} />
          <Route path="/register" element={<Register />} />
          <Route path="/students" element={<Students />} />
          <Route path="/records" element={<Records />} />
          <Route path="/evaluate" element={<Evaluate />} />
          <Route path="*" element={<Dashboard health={health} />} />
        </Routes>
      </main>
    </div>
  );
}
