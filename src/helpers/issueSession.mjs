/**
 * Extract session metadata from a request context for token creation.
 * @param {object} ctx request context
 * @param {string} authMethod how this token was issued (password, passkey, authorization_code, implicit)
 * @returns {object} metadata fields to spread into Token.create()
 */
export default function tokenMetadata (ctx, authMethod) {
  return {
    ipAddress: ctx.request?.ip || null,
    userAgent: ctx.state?.userAgent || ctx.request?.headers?.['user-agent'] || null,
    authMethod,
    lastAccess: new Date(),
  }
}
