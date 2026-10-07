import { Router } from 'express';
import { readFile } from '../lib/storage.js';

const router = Router();

// Streams a stored image (from S3 or local disk) to the browser.
// The S3 bucket stays private; only this server can read it.
router.get(/^\/(.+)$/, async (req, res, next) => {
  try {
    const key = req.params[0];
    if (key.includes('..')) return res.status(400).end();
    const { stream, contentType } = await readFile(key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    stream.pipe(res);
  } catch (err) {
    if (err.name === 'NoSuchKey') return res.status(404).end();
    next(err);
  }
});

export default router;
