import { Router } from 'express';
import Student from '../models/Student.js';
import Attendance from '../models/Attendance.js';
import { isValidDescriptor } from '../lib/match.js';
import { saveFile, deleteFile, dataUrlToBuffer } from '../lib/storage.js';

const router = Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const publicView = (s) => ({
  _id: s._id,
  name: s.name,
  rollNo: s.rollNo,
  department: s.department,
  year: s.year,
  samples: s.descriptors?.length || 0,
  photoKeys: s.photoKeys,
  createdAt: s.createdAt,
});

// List all registered students
router.get(
  '/',
  wrap(async (req, res) => {
    const students = await Student.find().sort({ rollNo: 1 });
    res.json(students.map(publicView));
  })
);

// Register a new student with face descriptors + face photos
router.post(
  '/',
  wrap(async (req, res) => {
    const { name, rollNo, department = '', year = '', descriptors = [], photos = [] } = req.body;
    if (!name?.trim() || !rollNo?.trim()) {
      return res.status(400).json({ error: 'Name and roll number are required.' });
    }
    if (!Array.isArray(descriptors) || descriptors.length === 0 || !descriptors.every(isValidDescriptor)) {
      return res.status(400).json({ error: 'At least one valid face sample is required.' });
    }
    const roll = rollNo.trim().toUpperCase();
    if (await Student.exists({ rollNo: roll })) {
      return res.status(409).json({ error: `Roll number ${roll} is already registered.` });
    }

    const photoKeys = [];
    for (let i = 0; i < Math.min(photos.length, 5); i++) {
      const { buffer, contentType } = dataUrlToBuffer(photos[i]);
      const key = `faces/${roll}/${Date.now()}_${i + 1}.jpg`;
      await saveFile(key, buffer, contentType);
      photoKeys.push(key);
    }

    const student = await Student.create({ name, rollNo: roll, department, year, descriptors, photoKeys });
    res.status(201).json(publicView(student));
  })
);

// Delete a student (and their face photos)
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    await Promise.all(student.photoKeys.map(deleteFile));
    await Attendance.deleteMany({ student: student._id });
    res.json({ deleted: true });
  })
);

export default router;
