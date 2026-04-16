import { Session } from '../db'

/**
 * Create a new Session row for a login event. Returns the session ID to link
 * onto the Token.
 * @param {object} arg function arguments object
 * @param {object} arg.ctx request context
 * @param {string} arg.userId id of the user logging in
 * @returns {Promise<string>} the new session's id
 */
export default async function issueSession ({ ctx, userId }) {
  const session = await Session.create({
    ip: ctx.request?.ip,
    userAgent: ctx.state?.userAgent || ctx.request?.headers?.['user-agent'],
    fingerprint: ctx.state?.fingerprint,
    userId,
    verified: true,
  })
  return session.id
}
