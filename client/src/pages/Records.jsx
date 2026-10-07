import { useEffect, useState } from 'react';
import { api, fileUrl, todayIST } from '../lib/api.js';

export default function Records() {
  const [date, setDate] = useState(todayIST());
  const [subject, setSubject] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api.records(date, subject).then(setData).catch((e) => setError(e.message));
  }, [date, subject]);

  const subjects = [...new Set((data?.records || []).map((r) => r.subject))];
  const csv = `/api/attendance/export.csv?date=${date}${subject ? `&subject=${encodeURIComponent(subject)}` : ''}`;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Attendance Records</h1>
          <p className="muted">
            {data ? `${data.records.length} record(s) on ${date} · ${data.totalStudents} students registered` : 'Loading…'}
          </p>
        </div>
        <a className="btn primary" href={csv}>
          Export CSV
        </a>
      </header>

      <div className="card filters">
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Subject
          <input list="subjects" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="All subjects" />
          <datalist id="subjects">
            {subjects.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
      </div>

      {error && <div className="notice error">{error}</div>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Roll no</th>
              <th>Name</th>
              <th>Subject</th>
              <th>Time</th>
              <th>Confidence</th>
              <th>Status</th>
              <th>Snapshot</th>
            </tr>
          </thead>
          <tbody>
            {data?.records.map((r, i) => (
              <tr key={r._id}>
                <td>{i + 1}</td>
                <td>{r.rollNo}</td>
                <td>{r.name}</td>
                <td>{r.subject}</td>
                <td>{new Date(r.markedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                <td>{r.confidence}%</td>
                <td>
                  <span className="pill green">Present</span>
                </td>
                <td>
                  {r.snapshotKey ? (
                    <a href={fileUrl(r.snapshotKey)} target="_blank" rel="noreferrer">
                      View
                    </a>
                  ) : (
                    '–'
                  )}
                </td>
              </tr>
            ))}
            {data && data.records.length === 0 && (
              <tr>
                <td colSpan="8" className="muted center">
                  No attendance for this date.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
