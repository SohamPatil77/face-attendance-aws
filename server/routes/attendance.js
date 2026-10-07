import { Router } from 'express';
import Student from '../models/Student.js';
import Attendance from '../models/Attendance.js';
import { matchFaces, isValidDescriptor, euclidean, THRESHOLD } from '../lib/match.js';
import { saveFile, dataUrlToBuffer } from '../lib/storage.js';
import { todayIST, lastNDaysIST } from '../lib/dates.js';

const router = Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Recognise faces: browser sends 128-d descriptors, server matches them
// against all registered students.
router.post(
  '/recognize',
  wrap(async (req, res) => {
    const { descriptors = [] } = req.body;
    if (!Array.isArray(descriptors) || !descriptors.every(isValidDescriptor)) {
      return res.status(400).json({ error: 'Invalid face descriptors' });
    }
    const students = await Student.find({}, { name: 1, rollNo: 1, descriptors: 1 }).lean();
    const started = process.hrtime.bigint();
    const results = matchFaces(descriptors, students);
    const matchMs = Number(process.hrtime.bigint() - started) / 1e6;
    res.json({ threshold: THRESHOLD, registered: students.length, matchMs: Math.round(matchMs * 100) / 100, results });
  })
);

// Evaluation: distance from each query face to every registered student
// (used by the Model Evaluation page to compute accuracy at many thresholds)
router.post(
  '/evaluate',
  wrap(async (req, res) => {
    const { descriptors = [] } = req.body;
    if (!Array.isArray(descriptors) || !descriptors.every(isValidDescriptor)) {
      return res.status(400).json({ error: 'Invalid face descriptors' });
    }
    const students = await Student.find({}, { name: 1, rollNo: 1, descriptors: 1 }).lean();
    const results = descriptors.map((q) =>
      students
        .map((s) => ({
          studentId: String(s._id),
          name: s.name,
          rollNo: s.rollNo,
          distance: Math.round(Math.min(...s.descriptors.map((d) => euclidean(q, d))) * 1000) / 1000,
        }))
        .sort((a, b) => a.distance - b.distance)
    );
    res.json({ threshold: THRESHOLD, results });
  })
);

// Mark recognised students present
router.post(
  '/mark',
  wrap(async (req, res) => {
    const { subject, matches = [], snapshot } = req.body;
    if (!subject?.trim()) return res.status(400).json({ error: 'Subject is required.' });
    const valid = matches.filter((m) => m.studentId);
    if (valid.length === 0) return res.status(400).json({ error: 'No recognised students to mark.' });

    const date = todayIST();
    let snapshotKey;
    if (snapshot) {
      const { buffer, contentType } = dataUrlToBuffer(snapshot);
      snapshotKey = `attendance/${date}/${Date.now()}.jpg`;
      await saveFile(snapshotKey, buffer, contentType);
    }

    const marked = [];
    const already = [];
    for (const m of valid) {
      const student = await Student.findById(m.studentId);
      if (!student) continue;
      const exists = await Attendance.findOne({ student: student._id, date, subject: subject.trim() });
      if (exists) {
        already.push({ name: student.name, rollNo: student.rollNo });
        continue;
      }
      await Attendance.create({
        student: student._id,
        name: student.name,
        rollNo: student.rollNo,
        date,
        subject: subject.trim(),
        distance: m.distance,
        confidence: m.confidence,
        snapshotKey,
      });
      marked.push({ name: student.name, rollNo: student.rollNo });
    }
    res.json({ date, subject: subject.trim(), marked, already, snapshotKey });
  })
);

// Attendance records (filter by date and subject)
router.get(
  '/',
  wrap(async (req, res) => {
    const date = req.query.date || todayIST();
    const filter = { date };
    if (req.query.subject) filter.subject = req.query.subject;
    const records = await Attendance.find(filter).sort({ markedAt: 1 }).lean();
    const totalStudents = await Student.countDocuments();
    res.json({ date, totalStudents, records });
  })
);

// Dashboard statistics
router.get(
  '/stats',
  wrap(async (req, res) => {
    const today = todayIST();
    const days = lastNDaysIST(7);
    const [totalStudents, totalRecords, todayPresent, subjects, perDay, recent] = await Promise.all([
      Student.countDocuments(),
      Attendance.countDocuments(),
      Attendance.distinct('student', { date: today }),
      Attendance.distinct('subject'),
      Attendance.aggregate([
        { $match: { date: { $in: days } } },
        { $group: { _id: '$date', students: { $addToSet: '$student' } } },
        { $project: { count: { $size: '$students' } } },
      ]),
      Attendance.find().sort({ markedAt: -1 }).limit(6).lean(),
    ]);
    const map = Object.fromEntries(perDay.map((d) => [d._id, d.count]));
    res.json({
      today,
      totalStudents,
      totalRecords,
      presentToday: todayPresent.length,
      subjects,
      last7Days: days.map((d) => ({ date: d, present: map[d] || 0 })),
      recent,
    });
  })
);

// Download attendance as CSV (opens in Excel)
router.get(
  '/export.csv',
  wrap(async (req, res) => {
    const date = req.query.date || todayIST();
    const filter = { date };
    if (req.query.subject) filter.subject = req.query.subject;
    const records = await Attendance.find(filter).sort({ rollNo: 1 }).lean();
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Roll No', 'Name', 'Subject', 'Date', 'Time (IST)', 'Confidence %', 'Status'],
      ...records.map((r) => [
        r.rollNo,
        r.name,
        r.subject,
        r.date,
        new Date(r.markedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        r.confidence,
        'Present',
      ]),
    ];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${date}.csv"`);
    res.send(rows.map((r) => r.map(esc).join(',')).join('\n'));
  })
);

export default router;
