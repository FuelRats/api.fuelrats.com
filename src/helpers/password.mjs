import * as constants from '../constants'

const bcryptRoundsPrefixIndex = 2

/**
 * Hash a password using bcrypt via Bun.password
 * @param {string} password password to hash
 * @param {number} [cost] bcrypt cost factor
 * @returns {Promise<string>} bcrypt hash
 */
export async function hashPassword (password, cost = constants.bcryptRoundsCount) {
  return Bun.password.hash(password, { algorithm: 'bcrypt', cost })
}

/**
 * Verify a password against a bcrypt hash via Bun.password
 * @param {string} password password to verify
 * @param {string} hash bcrypt hash to verify against
 * @returns {Promise<boolean>} true if password matches
 */
export async function verifyPassword (password, hash) {
  return Bun.password.verify(password, hash)
}

/**
 * Get the rounds/cost factor from a bcrypt hash string.
 * Standard MCF format: $2b$10$...
 * @param {string} hash bcrypt hash
 * @returns {number} rounds/cost factor
 */
export function getHashRounds (hash) {
  return parseInt(hash.split('$')[bcryptRoundsPrefixIndex], 10)
}
