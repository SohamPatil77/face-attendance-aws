import { useMemo, useState } from 'react';
import ModelStatus, { useModels } from '../components/ModelStatus.jsx';
import { detectAllFaces, fileToImage } from '../lib/face.js';

const THRESHOLDS = [0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65];
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const r3 = (x) => Math.round(x * 1000) / 1000;

/** Expected identity from the file name: "soham_3.jpg" -> "soham", "unknown_1.jpg" -> "unknown". */
function labelFromName(fileName) {
  return fileName.toLowerCase().replace(/\.[a-z]+$/, '').split(/[_\-\s\d]/)[0];
}

export default function Evaluate() {
  const models = useModels();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    setError('');
    const out = [];
    try {
      for (const f of files) {
        const img = await fileToImage(f);
        const det = await detectAllFaces(img, false);
        const expected = labelFromName(f.name);
        if (!det.faces.length) {
          out.push({ file: f.name, expected, faces: 0, ms: det.ms, ranking: [] });
          continue;
        }
        // largest face = the subject of a single-person test photo
        const face = det.faces.reduce((a, b) => (b.box.width * b.box.height > a.box.width * a.box.height ? b : a));
        const res = await fetch('/api/attendance/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ descriptors: [face.descriptor] }),
        }).then((r) => r.json());
        out.push({ file: f.name, expected, faces: det.faces.length, ms: det.ms, score: face.score, ranking: res.results?.[0] || [] });
        setRows([...out]);
      }
    } catch (err) {
      setError(err.message);
    }
    setRows(out);
    setBusy(false);
  }

  const stats = useMemo(() => {
    const scored = rows.filter((r) => r.ranking.length);
    const isMatch = (r, s) =>
      s.name.toLowerCase().split(' ')[0] === r.expected || s.rollNo.toLowerCase() === r.expected;
    const genuine = [];
    const impostor = [];
    for (const r of scored) {
      for (const s of r.ranking) (isMatch(r, s) ? genuine : impostor).push(s.distance);
    }
    const byT = THRESHOLDS.map((t) => {
      let correct = 0;
      let falseAccept = 0;
      let falseReject = 0;
      for (const r of scored) {
        const best = r.ranking[0];
        const known = r.ranking.some((s) => isMatch(r, s));
        const predictedKnown = best.distance < t;
        if (known) {
          if (predictedKnown && isMatch(r, best)) correct++;
          else if (!predictedKnown) falseReject++;
          else falseAccept++;
        } else if (!predictedKnown) correct++;
        else falseAccept++;
      }
      const n = scored.length || 1;
      return { t, accuracy: (correct / n) * 100, far: (falseAccept / n) * 100, frr: (falseReject / n) * 100 };
    });
    return {
      images: rows.length,
      detected: scored.length,
      detectionRate: rows.length ? (scored.length / rows.length) * 100 : 0,
      avgMs: mean(rows.map((r) => r.ms)),
      genuineMean: mean(genuine),
      genuineMax: genuine.length ? Math.max(...genuine) : 0,
      impostorMean: mean(impostor),
      impostorMin: impostor.length ? Math.min(...impostor) : 0,
      byT,
    };
  }, [rows]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Model Evaluation</h1>
          <p className="muted">
            Upload labelled test photos named like <code>soham_1.jpg</code>, <code>neha_2.jpg</code> or{' '}
            <code>unknown_1.jpg</code>. The AI is scored against the registered students.
          </p>
        </div>
        <ModelStatus state={models} />
      </header>

      <label className={`dropzone ${!models.ready || busy ? 'disabled' : ''}`}>
        <input type="file" accept="image/*" multiple onChange={run} disabled={!models.ready || busy} />
        <strong>{busy ? `Evaluating… (${rows.length} done)` : 'Choose test photos'}</strong>
        <span className="muted small">Test photos should be different from the registration photos</span>
      </label>
      {error && <div className="notice error">{error}</div>}

      {rows.length > 0 && (
        <>
          <section className="stats">
            <div className="stat">
              <div className="stat-label">Test images</div>
              <div className="stat-value">{stats.images}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Face detection rate</div>
              <div className="stat-value">{stats.detectionRate.toFixed(1)}%</div>
            </div>
            <div className="stat">
              <div className="stat-label">Accuracy @ 0.50</div>
              <div className="stat-value">{stats.byT.find((x) => x.t === 0.5).accuracy.toFixed(1)}%</div>
            </div>
            <div className="stat">
              <div className="stat-label">Avg. AI time / image</div>
              <div className="stat-value">{Math.round(stats.avgMs)} ms</div>
            </div>
          </section>

          <div className="grid-2">
            <div className="card table-wrap">
              <table id="threshold-table">
                <thead>
                  <tr>
                    <th>Threshold</th>
                    <th>Accuracy</th>
                    <th>False accept</th>
                    <th>False reject</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byT.map((x) => (
                    <tr key={x.t} style={x.t === 0.5 ? { background: '#f0fdfa', fontWeight: 600 } : undefined}>
                      <td>{x.t.toFixed(2)}</td>
                      <td>{x.accuracy.toFixed(1)}%</td>
                      <td>{x.far.toFixed(1)}%</td>
                      <td>{x.frr.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h2>Distance analysis</h2>
              <div className="kv" id="distance-stats">
                <div>Same person – mean</div>
                <div>{r3(stats.genuineMean)}</div>
                <div>Same person – worst (max)</div>
                <div>{r3(stats.genuineMax)}</div>
                <div>Different person – mean</div>
                <div>{r3(stats.impostorMean)}</div>
                <div>Different person – closest (min)</div>
                <div>{r3(stats.impostorMin)}</div>
                <div>Separation margin</div>
                <div>{r3(stats.impostorMin - stats.genuineMax)}</div>
              </div>
            </div>
          </div>

          <div className="card table-wrap">
            <table id="results-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Expected</th>
                  <th>Faces</th>
                  <th>Predicted (nearest)</th>
                  <th>Distance</th>
                  <th>Result @0.50</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const best = r.ranking[0];
                  const pred = best && best.distance < 0.5 ? best.name : 'Unknown';
                  const ok =
                    best &&
                    (pred === 'Unknown'
                      ? !r.ranking.some((s) => s.name.toLowerCase().split(' ')[0] === r.expected)
                      : best.name.toLowerCase().split(' ')[0] === r.expected || best.rollNo.toLowerCase() === r.expected);
                  return (
                    <tr key={r.file}>
                      <td>{r.file}</td>
                      <td>{r.expected}</td>
                      <td>{r.faces}</td>
                      <td>{best ? pred : '–'}</td>
                      <td>{best ? best.distance : '–'}</td>
                      <td>
                        <span className={`pill ${ok ? 'green' : 'red'}`}>{ok ? 'Correct' : 'Wrong'}</span>
                      </td>
                      <td>{r.ms} ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
