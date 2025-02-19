import config from '../config'
import { User } from '../db'

/**
 * Get a password reset link
 * @param {string} resetToken password reset token
 * @returns {string} password reset link
 */
function getResetLink (resetToken) {
  return `${config.frontend.url}/verify?type=reset&t=${resetToken}`
}

/**
 * Password reset email template
 * @param {object} arg function arguments object
 * @param {User} arg.user the user to send the email to
 * @param {string} arg.resetToken the reset token for this email
 * @returns {object} password reset email template
 */
export default function passwordResetEmail ({ user, resetToken }) {
  return {
    to: user.email,
    subject: 'Fuel Rats Password Reset Requested',
    template: 'reset',
    params: {
      name: user.displayName(),
      resetLink: getResetLink(resetToken),
    },
  }
}
