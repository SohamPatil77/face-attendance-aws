import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

function formatDay(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
}

export default function Dashboard({ health }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.stats().then(setStats).catch((e) => setError(e.message));
  }, []);

  const pct = stats && stats.totalStudents ? Math.round((stats.presentToday / stats.totalStudents) * 100) : 0;
  const max = stats ? Math.max(1, stats.totalStudents, ...stats.last7Days.map((d) => d.present)) : 1;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">
            Face-recognition attendance, running on AWS. Today:{' '}
            {new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full' })}
          </p>
        </div>
        <Link to="/attendance" className="btn primary">
          Take attendance
        </Link>
      </header>

      {error && <div className="notice error">{error}</div>}

      <section className="stats">
        <div className="stat">
          <div className="stat-label">Registered students</div>
          <div className="stat-value">{stats?.totalStudents ?? '–'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Present today</div>
          <div className="stat-value">{stats?.presentToday ?? '–'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Attendance today</div>
          <div className="stat-value">{stats ? `${pct}%` : '–'}</div>
          <div className="meter">
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Total records</div>
          <div className="stat-value">{stats?.totalRecords ?? '–'}</div>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2>Students present – last 7 days</h2>
          <div className="bars">
            {stats?.last7Days.map((d) => (
              <div className="bar-col" key={d.date} title={`${d.date}: ${d.present} present`}>
                <div className="bar-num">{d.present}</div>
                <div className="bar-track">
                  <div className="bar" style={{ height: `${(d.present / max) * 100}%` }} />
                </div>
                <div className="bar-label">{formatDay(d.date)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Recent check-ins</h2>
          {stats?.recent?.length ? (
            <ul className="list">
              {stats.recent.map((r) => (
                <li key={r._id}>
                  <div>
                    <strong>{r.name}</strong> <span className="muted">· {r.rollNo}</span>
                    <div className="muted small">
                      {r.subject} · {r.date}
                    </div>
                  </div>
                  <span className="pill green">{r.confidence}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No attendance marked yet.</p>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Cloud deployment status</h2>
        <div className="kv">
          <div>Platform</div>
          <div>{health?.server?.platform || '–'}</div>
          <div>EC2 instance</div>
          <div>{health?.server?.instanceId || '–'}</div>
          <div>Instance type / AZ</div>
          <div>{health?.server?.instanceType ? `${health.server.instanceType} / ${health.server.availabilityZone}` : '–'}</div>
          <div>Database</div>
          <div>MongoDB ({health?.database || '–'})</div>
          <div>File storage</div>
          <div>
            {health?.storage?.type || '–'}
            {health?.storage?.bucket ? ` · ${health.storage.bucket}` : ''}
          </div>
          <div>Server uptime</div>
          <div>{health ? `${Math.floor(health.uptimeSeconds / 60)} min` : '–'}</div>
        </div>
      </section>
    </div>
  );
}
