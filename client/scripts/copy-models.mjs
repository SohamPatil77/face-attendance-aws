// Copies the pre-trained neural network weights shipped with face-api.js
// into public/models so the browser can load them from our own server.
import fs from 'fs';
import path from 'path';

const src = path.resolve('node_modules/@vladmandic/face-api/model');
const dest = path.resolve('public/models');
const wanted = ['ssd_mobilenetv1_model', 'tiny_face_detector_model', 'face_landmark_68_model', 'face_recognition_model'];

fs.mkdirSync(dest, { recursive: true });
let n = 0;
for (const file of fs.readdirSync(src)) {
  if (wanted.some((w) => file.startsWith(w + '.') || file.startsWith(w + '-'))) {
    fs.copyFileSync(path.join(src, file), path.join(dest, file));
    n++;
  }
}
console.log(`Copied ${n} model files to public/models`);
