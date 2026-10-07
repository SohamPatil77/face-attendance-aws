import { useRef, useState } from 'react';
import Camera from '../components/Camera.jsx';
import ModelStatus, { useModels } from '../components/ModelStatus.jsx';
import { cropFace, detectOneFace, fileToImage } from '../lib/face.js';
import { api } from '../lib/api.js';

const MAX_SAMPLES = 5;
const empty = { name: '', rollNo: '', department: 'Computer Engineering', year: 'TE' };

export default function Register() {
  const models = useModels();
  const videoRef = useRef(null);
  const [mode, setMode] = useState('camera');
  const [form, setForm] = useState(empty);
  const [samples, setSamples] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function addFrom(source) {
    const face = await detectOneFace(source);
    if (!face) return false;
    setSamples((s) => [...s, { thumb: cropFace(source, face.box), descriptor: face.descriptor, score: face.score }].slice(0, MAX_SAMPLES));
    return true;
  }

  async function capture() {
    if (!videoRef.current) return;
    setBusy(true);
    setMsg(null);
    const ok = await addFrom(videoRef.current);
    if (!ok) setMsg({ type: 'warn', text: 'No face found. Look at the camera in good light and try again.' });
    setBusy(false);
  }

  async function upload(e) {
    const files = Array.from(e.target.files || []).slice(0, MAX_SAMPLES - samples.length);
    e.target.value = '';
    setBusy(true);
    setMsg(null);
    let failed = 0;
    for (const f of files) {
      const img = await fileToImage(f);
      if (!(await addFrom(img))) failed++;
    }
    if (failed) setMsg({ type: 'warn', text: `${failed} photo(s) had no clear face and were skipped.` });
    setBusy(false);
  }

  async function submit(e) {
    e.preventDefault();
    if (samples.length === 0) return setMsg({ type: 'error', text: 'Add at least one face sample (3–5 recommended).' });
    setBusy(true);
    setMsg(null);
    try {
      const s = await api.addStudent({
        ...form,
        descriptors: samples.map((x) => x.descriptor),
        photos: samples.map((x) => x.thumb),
      });
      setMsg({ type: 'success', text: `${s.name} (${s.rollNo}) registered with ${s.samples} face samples.` });
      setForm(empty);
      setSamples([]);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
    setBusy(false);
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Register Student</h1>
          <p className="muted">Capture 3–5 face samples. The AI turns each face into a 128-number “face descriptor”.</p>
        </div>
        <ModelStatus state={models} />
      </header>

      <div className="grid-2 wide-left">
        <div className="card">
          <div className="tabs">
            <button className={mode === 'camera' ? 'active' : ''} onClick={() => setMode('camera')} type="button">
              Webcam
            </button>
            <button className={mode === 'upload' ? 'active' : ''} onClick={() => setMode('upload')} type="button">
              Upload photos
            </button>
          </div>

          {mode === 'camera' ? (
            <>
              <Camera ref={videoRef} mirror />
              <button
                className="btn primary block"
                onClick={capture}
                disabled={!models.ready || busy || samples.length >= MAX_SAMPLES}
                type="button"
              >
                {busy ? 'Detecting face…' : `Capture sample (${samples.length}/${MAX_SAMPLES})`}
              </button>
              <p className="muted small">Tip: turn your head slightly between captures for better accuracy.</p>
            </>
          ) : (
            <label className={`dropzone ${!models.ready || busy ? 'disabled' : ''}`}>
              <input type="file" accept="image/*" multiple onChange={upload} disabled={!models.ready || busy} />
              <strong>{busy ? 'Detecting faces…' : 'Choose face photos'}</strong>
              <span className="muted small">One person per photo · JPG or PNG · up to {MAX_SAMPLES}</span>
            </label>
          )}

          <div className="samples">
            {Array.from({ length: MAX_SAMPLES }).map((_, i) =>
              samples[i] ? (
                <div className="sample" key={i}>
                  <img src={samples[i].thumb} alt={`Face sample ${i + 1}`} />
                  <button
                    type="button"
                    className="x"
                    aria-label="Remove sample"
                    onClick={() => setSamples(samples.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                  <span className="sample-score">{Math.round(samples[i].score * 100)}%</span>
                </div>
              ) : (
                <div className="sample empty" key={i}>
                  {i + 1}
                </div>
              )
            )}
          </div>
        </div>

        <form className="card form" onSubmit={submit}>
          <h2>Student details</h2>
          <label>
            Full name
            <input value={form.name} onChange={set('name')} required placeholder="e.g. Soham Patil" />
          </label>
          <label>
            Roll number
            <input value={form.rollNo} onChange={set('rollNo')} required placeholder="e.g. TECOE11" />
          </label>
          <label>
            Department
            <input value={form.department} onChange={set('department')} />
          </label>
          <label>
            Year
            <select value={form.year} onChange={set('year')}>
              <option>FE</option>
              <option>SE</option>
              <option>TE</option>
              <option>BE</option>
            </select>
          </label>
          {msg && <div className={`notice ${msg.type}`}>{msg.text}</div>}
          <button className="btn primary block" disabled={busy || samples.length === 0}>
            Register student
          </button>
        </form>
      </div>
    </div>
  );
}
