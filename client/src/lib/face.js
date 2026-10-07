// AI layer: face detection + 128-d face embeddings in the browser using
// face-api.js (built on Google's TensorFlow.js).
import * as faceapi from '@vladmandic/face-api/dist/face-api.esm.js';

let loading = null;

export function loadModels() {
  if (!loading) {
    loading = (async () => {
      await faceapi.tf.setBackend('webgl').catch(() => faceapi.tf.setBackend('cpu'));
      await faceapi.tf.ready();
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('/models'), // accurate face detector
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'), // fast detector for live webcam
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'), // 68 facial landmarks (alignment)
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'), // ResNet-34 -> 128-d descriptor
      ]);
      return faceapi.tf.getBackend();
    })();
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

const ssd = () => new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
const tiny = () => new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });

/** Detect every face in an image / video / canvas. fast=true uses the Tiny detector. */
export async function detectAllFaces(input, fast = false) {
  const t0 = performance.now();
  const results = await faceapi
    .detectAllFaces(input, fast ? tiny() : ssd())
    .withFaceLandmarks()
    .withFaceDescriptors();
  return {
    ms: Math.round(performance.now() - t0),
    faces: results.map((r) => ({
      box: r.detection.box,
      score: r.detection.score,
      descriptor: Array.from(r.descriptor),
    })),
  };
}

/** Detect the single most prominent face (used for registration samples). */
export async function detectOneFace(input) {
  const r = await faceapi.detectSingleFace(input, ssd()).withFaceLandmarks().withFaceDescriptor();
  if (!r) return null;
  return { box: r.detection.box, score: r.detection.score, descriptor: Array.from(r.descriptor) };
}

/** Draw labelled boxes onto a canvas. */
export function drawBoxes(ctx, faces, labels, scale = 1) {
  ctx.lineWidth = Math.max(2, 3 * scale);
  ctx.font = `600 ${Math.max(12, Math.round(16 * scale))}px Inter, sans-serif`;
  faces.forEach((f, i) => {
    const l = labels[i] || { text: 'Detecting…', ok: null };
    const color = l.ok === true ? '#10b981' : l.ok === false ? '#ef4444' : '#f59e0b';
    const { x, y, width, height } = f.box;
    ctx.strokeStyle = color;
    ctx.strokeRect(x, y, width, height);
    const text = l.text;
    const pad = 6 * scale;
    const th = Math.max(18, 24 * scale);
    const tw = ctx.measureText(text).width + pad * 2;
    const ty = y - th < 0 ? y + height : y - th;
    ctx.fillStyle = color;
    ctx.fillRect(x - ctx.lineWidth / 2, ty, tw, th);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, x + pad - ctx.lineWidth / 2, ty + th * 0.72);
  });
}

/** Load a File into an HTMLImageElement. */
export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Downscale any image source to a JPEG data URL (keeps uploads small). */
export function toJpeg(source, maxSide = 640, quality = 0.85) {
  const w = source.videoWidth || source.naturalWidth || source.width;
  const h = source.videoHeight || source.naturalHeight || source.height;
  const s = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * s);
  c.height = Math.round(h * s);
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

/** Crop a face region (with margin) to a square JPEG thumbnail. */
export function cropFace(source, box, size = 240) {
  const w = source.videoWidth || source.naturalWidth || source.width;
  const h = source.videoHeight || source.naturalHeight || source.height;
  const m = Math.max(box.width, box.height) * 0.35;
  const side = Math.max(box.width, box.height) + m * 2;
  const sx = Math.max(0, box.x + box.width / 2 - side / 2);
  const sy = Math.max(0, box.y + box.height / 2 - side / 2);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  c.getContext('2d').drawImage(source, sx, sy, Math.min(side, w - sx), Math.min(side, h - sy), 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.9);
}
