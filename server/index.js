import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import studentRoutes from './routes/students.js';
import attendanceRoutes from './routes/attendance.js';
import fileRoutes from './routes/files.js';
import { storageInfo } from './lib/storage.js';
import { getInstanceInfo } from './lib/ec2meta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/face_attendance';

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(morgan('combined'));

// ---------- API ----------
app.get('/api/health', async (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'ok',
    database: states[mongoose.connection.readyState] || 'unknown',
    storage: storageInfo(),
    server: await getInstanceInfo(),
    uptimeSeconds: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});

app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/files', fileRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// ---------- React frontend (built by Vite) ----------
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: '1h', index: false }));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// ---------- error handler ----------
app.use((err, req, res, next) => {
  console.error(err);
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'A record with this value already exists.' });
  }
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
