// src/middleware/upload.js
// Reusable file-upload middleware built on multer.
// Each "bucket" (hero, council, posts, signatures, etc.) writes to its own folder under public/uploads/.

import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is two levels up from src/middleware
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const UPLOADS_ROOT = path.join(PROJECT_ROOT, 'public', 'uploads');

// Allowed file types
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DOC_MIMES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

// 5 MB default, 2 MB for signatures (smaller is better for signatures)
const MAX_MB = Number(process.env.MAX_UPLOAD_MB) || 5;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024;

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const safeFilename = (originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  const base = path
    .basename(originalName, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'file';
  const stamp = Date.now();
  const rand = crypto.randomBytes(3).toString('hex');
  return `${base}-${stamp}-${rand}${ext}`;
};

const makeStorage = (bucket) => {
  const dest = path.join(UPLOADS_ROOT, bucket);
  ensureDir(dest);

  return multer.diskStorage({
    destination: (req, file, cb) => {
      ensureDir(dest);
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      cb(null, safeFilename(file.originalname));
    },
  });
};

const makeUploader = (bucket, opts = {}) => {
  const mimes = opts.mimes || IMAGE_MIMES;
  const maxBytes = opts.maxBytes || MAX_BYTES;

  return multer({
    storage: makeStorage(bucket),
    limits: { fileSize: maxBytes },
    fileFilter: (req, file, cb) => {
      if (!mimes.includes(file.mimetype)) {
        const err = new Error(
          `Invalid file type. Allowed: ${mimes
            .map((m) => m.split('/')[1].toUpperCase())
            .join(', ')}.`
        );
        err.code = 'INVALID_MIME';
        return cb(err);
      }
      cb(null, true);
    },
  });
};

const attachPublicPath = (bucket) => (req, res, next) => {
  if (req.file) {
    req.file.publicPath = `/uploads/${bucket}/${req.file.filename}`;
    req.file.bucket = bucket;
  }
  if (Array.isArray(req.files)) {
    req.files.forEach((f) => {
      f.publicPath = `/uploads/${bucket}/${f.filename}`;
      f.bucket = bucket;
    });
  } else if (req.files && typeof req.files === 'object') {
    Object.values(req.files).forEach((arr) => {
      if (Array.isArray(arr)) {
        arr.forEach((f) => {
          f.publicPath = `/uploads/${bucket}/${f.filename}`;
          f.bucket = bucket;
        });
      }
    });
  }
  next();
};

export const handleUploadErrors = (redirectTo) => (err, req, res, next) => {
  if (err && (err.code === 'LIMIT_FILE_SIZE' || err.code === 'INVALID_MIME')) {
    req.flash('error', err.code === 'LIMIT_FILE_SIZE'
      ? `File too large. Max ${MAX_MB} MB.`
      : err.message);
    return res.redirect(redirectTo || req.get('Referer') || '/admin');
  }
  return next(err);
};

// ─── Per-bucket uploaders ───────────────────────────────

const heroMulter = makeUploader('hero');
export const uploadHero = [heroMulter.single('image'), attachPublicPath('hero')];

const councilMulter = makeUploader('council');
export const uploadCouncil = [councilMulter.single('photo'), attachPublicPath('council')];

const postMulter = makeUploader('posts');
export const uploadPost = [postMulter.single('cover'), attachPublicPath('posts')];

const testimonialMulter = makeUploader('testimonials');
export const uploadTestimonial = [testimonialMulter.single('photo'), attachPublicPath('testimonials')];

const brandingMulter = makeUploader('branding');
export const uploadBranding = [brandingMulter.single('image'), attachPublicPath('branding')];

// Signatures: small PNG/JPG, 2 MB max
const signatureMulter = makeUploader('branding/signatures', {
  mimes: IMAGE_MIMES,
  maxBytes: SIGNATURE_MAX_BYTES,
});
export const uploadSignature = [signatureMulter.single('signature'), attachPublicPath('branding/signatures')];

// Applications: CV + photo in one request
const appMulter = makeUploader('applications', {
  mimes: [...IMAGE_MIMES, ...DOC_MIMES],
  maxBytes: 5 * 1024 * 1024,
});
export const uploadApplication = [
  appMulter.fields([
    { name: 'cv', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
  ]),
  attachPublicPath('applications'),
];

export default makeUploader;