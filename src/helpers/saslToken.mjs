import crypto from 'crypto'

/** Seconds either side of its timestamp that the groupsync Anope module accepts a token for */
export const saslTokenLifetimeSeconds = 60

const saslTokenPrefix = 'frk1'

/**
 * Mint a one-time IRC SASL PLAIN password in the form the groupsync Anope module accepts:
 * `frk1:<ts>:<lowercase hex HMAC-SHA256(secret, "<account>|<ts>")>`
 * @param {string} secret the secret shared with the module (its `sasltoken_secretfile`)
 * @param {string} account the alias exactly as the client sends it as the SASL authcid
 * @param {number} ts the issue time in whole unix seconds
 * @returns {string} the SASL PLAIN password
 */
export function mintSaslToken (secret, account, ts) {
  const mac = crypto.createHmac('sha256', secret).update(`${account}|${ts}`).digest('hex')
  return `${saslTokenPrefix}:${ts}:${mac}`
}
