import { useEffect, useRef, useState } from 'react';
import Camera from '../components/Camera.jsx';
import ModelStatus, { useModels } from '../components/ModelStatus.jsx';
import { detectAllFaces, drawBoxes, fileToImage, toJpeg } from '../lib/face.js';
import { api } from '../lib/api.js';

const labelsFor = (results) =>
  results.map((r) => ({
    text: r.matched ? `${r.name} ${Math.round(r.confidence)}%` : 'Unknown',
    ok: r.matched,
  }));

export default function TakeAttendance() {
  const models = useModels();
  const [mode, setMode] = useState('camera');
  const [subject, setSubject] = useState('Artificial Intelligence');
  const [seen, setSeen] = useState({}); // studentId -> best match
  const [frame, setFrame] = useState({ faces: 0, unknown: 0, detectMs: 0, matchMs: 0 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [running, setRunning] = useState(true);

  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const loopRef = useRef({ active: false, timer: null });

  function remember(results) {
    setSeen((prev) => {
      const next = { ...prev };
      for (const r of results) {
        if (!r.matched) continue;
        if (!next[r.studentId] || r.distance < next[r.studentId].distance) next[r.studentId] = r;
      }
      return next;
    });
  }

  async function analyse(source, fast) {
    const det = await detectAllFaces(source, fast);
    let rec = { results: [], matchMs: 0 };
    if (det.faces.length) rec = await api.recognize(det.faces.map((f) => f.descriptor));
    setFrame({
      faces: det.faces.length,
      unknown: rec.results.filter((r) => !r.matched).length,
      detectMs: det.ms,
      matchMs: rec.matchMs,
    });
    remember(rec.results);
    return { faces: det.faces, results: rec.results };
  }

  // ----- live webcam loop -----
  useEffect(() => {
    if (mode !== 'camera' || !models.ready || !running) return;
    const loop = loopRef.current;
    loop.active = true;
    const tick = async () => {
      const v = videoRef.current;
      const c = overlayRef.current;
      if (!loop.active) return;
      if (v && c && v.readyState >= 2 && v.videoWidth) {
        try {
          const { faces, results } = await analyse(v, true);
          if (!loop.active) return;
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          const ctx = c.getContext('2d');
          ctx.clearRect(0, 0, c.width, c.height);
          drawBoxes(ctx, faces, labelsFor(results), c.width / 900);
        } catch (e) {
          setMsg({ type: 'error', text: e.message });
        }
      }
      if (loop.active) loop.timer = setTimeout(tick, 600);
    };
    tick();
    return () => {
      loop.active = false;
      clearTimeout(loop.timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, models.ready, running]);

  // ----- uploaded class photo -----
  async function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setMsg(null);
    setSeen({});
    try {
      const img = await fileToImage(file);
      const c = photoCanvasRef.current;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const { faces, results } = await analyse(img, false);
      drawBoxes(ctx, faces, labelsFor(results), Math.max(c.width, c.height) / 1100);
      if (!faces.length) setMsg({ type: 'warn', text: 'No faces detected in this photo.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
    setBusy(false);
  }

  function snapshot() {
    if (mode === 'upload') return photoCanvasRef.current?.width ? toJpeg(photoCanvasRef.current, 1280) : undefined;
    const v = videoRef.current;
    const o = overlayRef.current;
    if (!v?.videoWidth) return undefined;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(v, 0, 0);
    if (o) ctx.drawImage(o, 0, 0);
    return toJpeg(c, 1280);
  }

  async function mark() {
    const matches = Object.values(seen);
    if (!matches.length) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.mark({ subject, matches, snapshot: snapshot() });
      const parts = [];
      if (r.marked.length) parts.push(`Marked present: ${r.marked.map((m) => m.name).join(', ')}.`);
      if (r.already.length) parts.push(`Already marked today: ${r.already.map((m) => m.name).join(', ')}.`);
      setMsg({ type: 'success', text: parts.join(' ') });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
    setBusy(false);
  }

  function switchMode(m) {
    setMode(m);
    setSeen({});
    setMsg(null);
    setFrame({ faces: 0, unknown: 0, detectMs: 0, matchMs: 0 });
  }

  const recognised = Object.values(seen);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Take Attendance</h1>
          <p className="muted">Faces are detected in the browser, then matched with registered students on the EC2 server.</p>
        </div>
        <ModelStatus state={models} />
      </header>

      <div className="grid-2 wide-left">
        <div className="card">
          <div className="tabs">
            <button className={mode === 'camera' ? 'active' : ''} onClick={() => switchMode('camera')} type="button">
              Live webcam
            </button>
            <button className={mode === 'upload' ? 'active' : ''} onClick={() => switchMode('upload')} type="button">
              Upload class photo
            </button>
          </div>

          {mode === 'camera' ? (
            <>
              <Camera ref={videoRef}>
                <canvas ref={overlayRef} className="overlay" />
              </Camera>
              <button className="btn ghost small-btn" type="button" onClick={() => setRunning((r) => !r)}>
                {running ? 'Pause recognition' : 'Resume recognition'}
              </button>
            </>
          ) : (
            <>
              <label className={`dropzone ${!models.ready || busy ? 'disabled' : ''}`}>
                <input type="file" accept="image/*" onChange={onPhoto} disabled={!models.ready || busy} />
                <strong>{busy ? 'Analysing photo…' : 'Choose a classroom / group photo'}</strong>
                <span className="muted small">All faces in the photo are recognised at once</span>
              </label>
              <canvas ref={photoCanvasRef} className="photo-canvas" />
            </>
          )}

          <div className="metrics">
            <div>
              <span>{frame.faces}</span>faces in view
            </div>
            <div>
              <span>{frame.unknown}</span>unknown
            </div>
            <div>
              <span>{frame.detectMs} ms</span>AI detection
            </div>
            <div>
              <span>{frame.matchMs} ms</span>server matching
            </div>
          </div>
        </div>

        <div className="card form">
          <h2>Session</h2>
          <label>
            Subject / lecture
            <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>

          <h3>Recognised students ({recognised.length})</h3>
          {recognised.length ? (
            <ul className="list">
              {recognised.map((r) => (
                <li key={r.studentId}>
                  <div>
                    <strong>{r.name}</strong>
                    <div className="muted small">
                      {r.rollNo} · distance {r.distance}
                    </div>
                  </div>
                  <span className="pill green">{r.confidence}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nobody recognised yet.</p>
          )}

          {msg && <div className={`notice ${msg.type}`}>{msg.text}</div>}

          <button className="btn primary block" disabled={busy || !recognised.length || !subject.trim()} onClick={mark} type="button">
            Mark {recognised.length || ''} present
          </button>
          {recognised.length > 0 && (
            <button className="btn ghost block" type="button" onClick={() => setSeen({})}>
              Clear list
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
