import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { resolve, join } from 'path'

const CACHE_DIR = resolve('data/avatar-cache')

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true })
}

/**
 * Get the cache directory for a specific user
 * @param {string} userId user UUID
 * @returns {string} path to user's cache dir
 */
function userDir (userId) {
  return join(CACHE_DIR, userId)
}

/**
 * Get the cache file path for a specific avatar variant
 * @param {string} userId user UUID
 * @param {number} size image size in pixels
 * @param {string} format image format (webp, png, jpeg)
 * @returns {string} cache file path
 */
function cachePath (userId, size, format) {
  return join(userDir(userId), `${size}.${format}`)
}

/**
 * Get a cached avatar variant, or null if not cached
 * @param {string} userId user UUID
 * @param {number} size image size in pixels
 * @param {string} format image format
 * @returns {Promise<Buffer|null>} cached image data or null
 */
export async function getCached (userId, size, format) {
  const path = cachePath(userId, size, format)
  try {
    return await Bun.file(path).arrayBuffer().then(Buffer.from)
  } catch {
    return null
  }
}

/**
 * Store a cached avatar variant on disk
 * @param {string} userId user UUID
 * @param {number} size image size in pixels
 * @param {string} format image format
 * @param {Buffer} data image data
 */
export async function setCached (userId, size, format, data) {
  const dir = userDir(userId)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  await Bun.write(cachePath(userId, size, format), data)
}

/**
 * Invalidate all cached variants for a user. Called on upload or delete.
 * @param {string} userId user UUID
 */
export function invalidateCache (userId) {
  const dir = userDir(userId)
  if (!existsSync(dir)) {
    return
  }
  try {
    const files = readdirSync(dir)
    for (const file of files) {
      unlinkSync(join(dir, file))
    }
  } catch {
    // Non-critical — stale cache will be overwritten on next request
  }
}
