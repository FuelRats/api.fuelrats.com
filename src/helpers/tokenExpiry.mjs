const secondsPerHour = 60 * 60
const msPerHour = secondsPerHour * 1000
const hoursPerDay = 24

/** Lifetime of an access token issued to a public OAuth client */
export const publicTokenLifetimeHours = 12

/** Lifetime of an access token issued to a public OAuth client, as sent in the token response's expires_in */
export const publicTokenLifetimeSeconds = publicTokenLifetimeHours * secondsPerHour

/**
 * How long an expired public-client token row is kept. Token rows double as the record of the
 * user's consent for a client (OAuth2 authorize skips the consent screen when one exists), so
 * they outlive the token itself.
 */
export const publicTokenRetentionDays = 30

/**
 * Get the expiry time for an access token issued to a public OAuth client
 * @param {Date} [now] the issue time
 * @returns {Date} the time the token stops authenticating
 */
export function publicTokenExpiry (now = new Date()) {
  return new Date(now.getTime() + (publicTokenLifetimeHours * msPerHour))
}

/**
 * Check whether a token expiry time has passed. Tokens without an expiry never expire.
 * @param {Date|string|null|undefined} expiresAt the token's expiresAt value
 * @param {Date} [now] the time to compare against
 * @returns {boolean} true if the token has an expiry time and it is not in the future
 */
export function isTokenExpired (expiresAt, now = new Date()) {
  if (!expiresAt) {
    return false
  }
  return new Date(expiresAt).getTime() <= now.getTime()
}

/**
 * Get the cutoff before which expired public-client token rows are deleted
 * @param {Date} [now] the time the cleanup runs
 * @returns {Date} rows whose expiresAt is earlier than this are past the retention window
 */
export function publicTokenPruneCutoff (now = new Date()) {
  return new Date(now.getTime() - (publicTokenRetentionDays * hoursPerDay * msPerHour))
}
