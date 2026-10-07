import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    rollNo: { type: String, required: true, unique: true, trim: true, uppercase: true },
    department: { type: String, trim: true, default: '' },
    year: { type: String, trim: true, default: '' },
    // Each descriptor is a 128-number face embedding produced by the
    // ResNet-34 face recognition network (face-api.js / TensorFlow.js).
    descriptors: {
      type: [[Number]],
      validate: {
        validator: (arr) => arr.length > 0 && arr.every((d) => d.length === 128),
        message: 'At least one 128-length face descriptor is required',
      },
    },
    photoKeys: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Student', studentSchema);
