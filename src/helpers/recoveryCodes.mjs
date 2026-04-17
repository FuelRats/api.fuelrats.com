import crypto from 'crypto'
import { hashPassword, verifyPassword } from './password'

const RECOVERY_CODE_COUNT = 10
const RECOVERY_CODE_BYTES = 4
const RECOVERY_CODE_COST = 8 // lower than passwords — recovery codes are already random

/**
 * Format a hex string as xxxx-xxxx
 * @param {string} hex hex string (8 chars)
 * @returns {string} formatted code
 */
function formatCode (hex) {
  return `${hex.slice(0, RECOVERY_CODE_BYTES)}-${hex.slice(RECOVERY_CODE_BYTES)}`
}

/**
 * Normalise a recovery code for comparison (lowercase, strip non-hex chars)
 * @param {string} code user-provided code
 * @returns {string} normalised code
 */
export function normaliseRecoveryCode (code) {
  return String(code).toLowerCase().replace(/[^a-f0-9]/gu, '')
}

/**
 * Generate a set of recovery codes
 * @returns {Promise<{raw: string[], hashes: string[]}>} raw codes to show user, hashes to store
 */
export async function generateRecoveryCodes () {
  const raw = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    return formatCode(crypto.randomBytes(RECOVERY_CODE_BYTES).toString('hex'))
  })
  const hashes = await Promise.all(raw.map((code) => {
    return hashPassword(normaliseRecoveryCode(code), RECOVERY_CODE_COST)
  }))
  return { raw, hashes }
}

/**
 * Verify a recovery code against a list of hashes.
 * @param {string} code user-provided code
 * @param {string[]} hashes stored code hashes
 * @returns {Promise<number>} index of matching hash, or -1 if no match
 */
export async function verifyRecoveryCode (code, hashes) {
  const normalised = normaliseRecoveryCode(code)
  if (!normalised) {
    return -1
  }

  for (let i = 0; i < hashes.length; i += 1) {
    if (await verifyPassword(normalised, hashes[i])) {
      return i
    }
  }
  return -1
}
