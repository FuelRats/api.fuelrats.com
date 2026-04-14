import { getCookie, setCookie } from 'hono/cookie'
import crypto from 'crypto'

const COOKIE_NAME = 'fuelrats_session'

/**
 * Sign a value with HMAC-SHA256
 * @param {string} value value to sign
 * @param {string} secret signing secret
 * @returns {string} signed value
 */
function sign (value, secret) {
  const signature = crypto.createHmac('sha256', secret).update(value).digest('base64url')
  return `${value}.${signature}`
}

/**
 * Verify and extract a signed value
 * @param {string} signed signed value
 * @param {string} secret signing secret
 * @returns {string|null} original value or null if invalid
 */
function unsign (signed, secret) {
  const lastDot = signed.lastIndexOf('.')
  if (lastDot === -1) {
    return null
  }
  const value = signed.substring(0, lastDot)
  const expected = sign(value, secret)
  if (signed === expected) {
    return value
  }
  return null
}

/**
 * Create a cookie-based session middleware for Hono
 * @param {string} secret cookie signing secret
 * @returns {Function} Hono middleware
 */
export function sessionMiddleware (secret) {
  return async (c, next) => {
    // Read session from signed cookie
    const raw = getCookie(c, COOKIE_NAME)
    let session = {}

    if (raw) {
      const unsigned = unsign(raw, secret)
      if (unsigned) {
        try {
          session = JSON.parse(Buffer.from(unsigned, 'base64').toString('utf8'))
        } catch {
          // Invalid session data, start fresh
        }
      }
    }

    // Make session available to route handlers
    c.set('session', session)

    // Provide a callback for decorators to write session changes
    let sessionModified = false
    const originalJson = JSON.stringify(session)
    c.set('writeSession', (updatedSession) => {
      session = updatedSession
      sessionModified = true
    })

    await next()

    // Write session back to cookie if it was modified
    const currentJson = JSON.stringify(session)
    if (sessionModified || currentJson !== originalJson) {
      const encoded = Buffer.from(currentJson).toString('base64')
      const signed = sign(encoded, secret)
      setCookie(c, COOKIE_NAME, signed, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: 86400, // 24 hours
      })
    }
  }
}
