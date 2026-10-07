import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fileUrl } from '../lib/api.js';

export default function Students() {
  const [students, setStudents] = useState(null);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState(null);

  const load = () => api.students().then(setStudents).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function remove(id) {
    try {
      await api.deleteStudent(id);
      setConfirmId(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Students</h1>
          <p className="muted">Face photos are stored in Amazon S3; face descriptors in MongoDB.</p>
        </div>
        <Link to="/register" className="btn primary">
          Register student
        </Link>
      </header>
      {error && <div className="notice error">{error}</div>}
      {students && students.length === 0 && (
        <div className="card empty-state">
          <p>No students registered yet.</p>
          <Link to="/register" className="btn primary">
            Register the first student
          </Link>
        </div>
      )}
      <div className="student-grid">
        {students?.map((s) => (
          <div className="card student" key={s._id}>
            <div className="faces">
              {s.photoKeys.slice(0, 3).map((k) => (
                <img key={k} src={fileUrl(k)} alt={`${s.name} face sample`} loading="lazy" />
              ))}
            </div>
            <div className="student-name">{s.name}</div>
            <div className="muted small">
              {s.rollNo} · {s.year} {s.department}
            </div>
            <div className="muted small">{s.samples} face samples</div>
            {confirmId === s._id ? (
              <div className="row">
                <button className="btn danger" type="button" onClick={() => remove(s._id)}>
                  Confirm delete
                </button>
                <button className="btn ghost" type="button" onClick={() => setConfirmId(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button className="btn ghost" type="button" onClick={() => setConfirmId(s._id)}>
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
