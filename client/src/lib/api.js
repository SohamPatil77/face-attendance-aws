async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  health: () => request('/api/health'),
  stats: () => request('/api/attendance/stats'),
  students: () => request('/api/students'),
  addStudent: (body) => request('/api/students', { method: 'POST', body }),
  deleteStudent: (id) => request(`/api/students/${id}`, { method: 'DELETE' }),
  recognize: (descriptors) => request('/api/attendance/recognize', { method: 'POST', body: { descriptors } }),
  mark: (body) => request('/api/attendance/mark', { method: 'POST', body }),
  records: (date, subject) =>
    request(`/api/attendance?date=${encodeURIComponent(date)}${subject ? `&subject=${encodeURIComponent(subject)}` : ''}`),
};

export const fileUrl = (key) => `/api/files/${key}`;

export const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
