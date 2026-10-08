// src/utils/fileCleanup.js
// Safe helper to delete a previously uploaded file from public/uploads/.
// Never throws — always returns true/false and logs issues.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// public/uploads absolute path
const UPLOADS_ROOT = path.resolve(__dirname, '..', '..', 'public', 'uploads');

/**
 * Delete an uploaded file given its public path.
 * @param {string} publicPath  e.g. "/uploads/hero/slide1.jpg" or null/undefined.
 * @param {string[]} allowedBuckets  Optional whitelist of buckets; if provided,
 *                                   deletion is skipped for anything else.
 * @returns {Promise<boolean>}  true if a file was deleted, false otherwise.
 */
export const deleteUploadedFile = async (publicPath, allowedBuckets = null) => {
  if (!publicPath || typeof publicPath !== 'string') return false;
  if (!publicPath.startsWith('/uploads/')) return false;

  // Strip /uploads/ prefix
  const rel = publicPath.replace(/^\/uploads\//, '');

  // Bucket is first segment
  const bucket = rel.split('/')[0];
  if (allowedBuckets && !allowedBuckets.includes(bucket)) return false;

  // Guard against path traversal
  const normalized = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
  if (normalized.includes('..')) return false;

  const abs = path.join(UPLOADS_ROOT, normalized);

  // Ensure the resolved path is still inside UPLOADS_ROOT
  const resolved = path.resolve(abs);
  if (!resolved.startsWith(UPLOADS_ROOT + path.sep) && resolved !== UPLOADS_ROOT) {
    console.warn('[fileCleanup] refusing to delete outside uploads:', publicPath);
    return false;
  }

  try {
    await fs.unlink(resolved);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false; // already gone — fine
    console.warn('[fileCleanup] failed to delete', resolved, err.message);
    return false;
  }
};

/**
 * Delete a file only if it differs from the new one.
 * Useful when replacing: don't delete if admin didn't change the image.
 * @param {string|null} oldPath
 * @param {string|null} newPath
 * @param {string[]} allowedBuckets
 */
export const replaceUploadedFile = async (oldPath, newPath, allowedBuckets = null) => {
  if (!oldPath || oldPath === newPath) return false;
  return deleteUploadedFile(oldPath, allowedBuckets);
};