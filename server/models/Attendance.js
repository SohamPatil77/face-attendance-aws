import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    name: { type: String, required: true },
    rollNo: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD (IST)
    subject: { type: String, required: true, trim: true },
    distance: { type: Number }, // Euclidean distance of the match (lower = better)
    confidence: { type: Number }, // 0-100 %
    snapshotKey: { type: String },
    markedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// A student can be marked present only once per subject per day.
attendanceSchema.index({ student: 1, date: 1, subject: 1 }, { unique: true });

export default mongoose.model('Attendance', attendanceSchema);
