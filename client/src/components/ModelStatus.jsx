import { useEffect, useState } from 'react';
import { loadModels } from '../lib/face.js';

/** Loads the neural-network weights once and shows their status. */
export function useModels() {
  const [state, setState] = useState({ ready: false, backend: '', error: '' });
  useEffect(() => {
    let alive = true;
    loadModels()
      .then((backend) => alive && setState({ ready: true, backend, error: '' }))
      .catch((e) => alive && setState({ ready: false, backend: '', error: e.message }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export default function ModelStatus({ state }) {
  if (state.error) return <span className="pill red">AI models failed to load: {state.error}</span>;
  if (!state.ready) return <span className="pill amber"><span className="spinner" /> Loading AI models…</span>;
  return <span className="pill green">● AI models ready ({state.backend.toUpperCase()})</span>;
}
