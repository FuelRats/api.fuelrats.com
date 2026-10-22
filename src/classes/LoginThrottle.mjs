const windowMs = 15 * 60 * 1000
const lockoutMs = 15 * 60 * 1000
// Per-account lockout is the primary control; the per-IP cap is looser so a shared NAT address
// is not locked out by a handful of unrelated failures, while still bounding credential spraying.
const accountMaxAttempts = 5
const ipMaxAttempts = 25

/**
 * Normalise an email for use as a throttle key
 * @param {string} email the email to normalise
 * @returns {string} the normalised email
 */
function normaliseEmail (email) {
  return (email ?? '').toLowerCase()
}

/**
 * In-memory throttle for failed password authentication attempts, keyed on both the account and
 * the real client IP. Checked before the bcrypt verify so throttled attempts cost nothing, and
 * so a locked-out account or IP cannot be brute-forced. State is per-process and best-effort.
 */
class LoginThrottle {
  #store = new Map()

  /**
   * Get or create the entry for a key
   * @param {string} key the throttle key
   * @returns {{attempts: number[], lockedUntil: number}} the entry
   */
  #entry (key) {
    let entry = this.#store.get(key)
    if (!entry) {
      entry = { attempts: [], lockedUntil: 0 }
      this.#store.set(key, entry)
    }
    return entry
  }

  /**
   * Whether a key is currently locked out
   * @param {string} key the throttle key
   * @param {number} now the current timestamp
   * @returns {boolean} whether the key is locked
   */
  #locked (key, now) {
    const entry = this.#store.get(key)
    return Boolean(entry && entry.lockedUntil > now)
  }

  /**
   * Record a failed attempt against a key, locking it if it reaches the limit
   * @param {string} key the throttle key
   * @param {number} max the attempt limit for this key
   * @param {number} now the current timestamp
   */
  #bump (key, max, now) {
    const entry = this.#entry(key)
    entry.attempts = entry.attempts.filter((timestamp) => {
      return now - timestamp < windowMs
    })
    entry.attempts.push(now)
    if (entry.attempts.length >= max) {
      entry.lockedUntil = now + lockoutMs
      entry.attempts = []
    }
  }

  /**
   * Drop entries with no recent attempts and no active lock, to bound memory
   * @param {number} now the current timestamp
   */
  #evict (now) {
    for (const [key, entry] of this.#store) {
      const hasRecentAttempt = entry.attempts.some((timestamp) => {
        return now - timestamp < windowMs
      })
      if (!hasRecentAttempt && entry.lockedUntil <= now) {
        this.#store.delete(key)
      }
    }
  }

  /**
   * Whether password authentication for this account or IP is currently locked out
   * @param {object} arg function arguments object
   * @param {string} arg.email the account email being authenticated
   * @param {string} arg.ip the real client IP
   * @returns {boolean} whether the attempt should be rejected before verifying the password
   */
  isLimited ({ email, ip }) {
    const now = Date.now()
    return this.#locked(`account:${normaliseEmail(email)}`, now)
      || this.#locked(`ip:${ip ?? ''}`, now)
  }

  /**
   * Record a failed password attempt against the account and IP
   * @param {object} arg function arguments object
   * @param {string} arg.email the account email being authenticated
   * @param {string} arg.ip the real client IP
   */
  recordFailure ({ email, ip }) {
    const now = Date.now()
    this.#bump(`account:${normaliseEmail(email)}`, accountMaxAttempts, now)
    this.#bump(`ip:${ip ?? ''}`, ipMaxAttempts, now)
    this.#evict(now)
  }

  /**
   * Clear the account's failure count on a successful authentication. The IP bucket is left intact
   * so an attacker cannot reset spray protection by logging into their own account.
   * @param {object} arg function arguments object
   * @param {string} arg.email the account email that authenticated
   */
  recordSuccess ({ email }) {
    this.#store.delete(`account:${normaliseEmail(email)}`)
  }
}

export default new LoginThrottle()
