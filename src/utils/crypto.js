/**
 * crypto.js — lightweight client-side hashing utility
 *
 * Uses the native Web Crypto API (available in all modern browsers).
 * NOTE: In production, password verification must happen server-side
 * with bcrypt/argon2. This is a frontend-only stopgap until the
 * backend API is connected.
 */

export async function sha256(str) {
  const buf    = new TextEncoder().encode(str)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Compare a plaintext password against a stored sha256 hash */
export async function verifyPassword(plaintext, hash) {
  const hashed = await sha256(plaintext)
  return hashed === hash
}