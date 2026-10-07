// File storage: Amazon S3 when S3_BUCKET is set (on EC2 the IAM role gives
// access, so no keys are stored in the code), otherwise a local folder.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION || 'ap-south-1';
const LOCAL_DIR = path.join(__dirname, '..', 'uploads');

const s3 = BUCKET ? new S3Client({ region: REGION }) : null;

export function storageInfo() {
  return BUCKET ? { type: 'Amazon S3', bucket: BUCKET, region: REGION } : { type: 'Local disk', path: LOCAL_DIR };
}

export function dataUrlToBuffer(dataUrl) {
  const m = /^data:(image\/[a-z]+);base64,(.+)$/i.exec(dataUrl || '');
  if (!m) throw Object.assign(new Error('Invalid image data'), { status: 400 });
  return { contentType: m[1], buffer: Buffer.from(m[2], 'base64') };
}

export async function saveFile(key, buffer, contentType = 'image/jpeg') {
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }));
  } else {
    const file = path.join(LOCAL_DIR, key);
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.writeFile(file, buffer);
  }
  return key;
}

export async function readFile(key) {
  if (s3) {
    const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return { stream: out.Body, contentType: out.ContentType || 'image/jpeg' };
  }
  const file = path.join(LOCAL_DIR, key);
  if (!file.startsWith(LOCAL_DIR) || !fs.existsSync(file)) {
    throw Object.assign(new Error('File not found'), { status: 404 });
  }
  return { stream: fs.createReadStream(file), contentType: 'image/jpeg' };
}

export async function deleteFile(key) {
  try {
    if (s3) await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    else await fs.promises.unlink(path.join(LOCAL_DIR, key));
  } catch {
    /* ignore */
  }
}
