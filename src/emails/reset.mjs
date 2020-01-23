import config from '../config'
import { User } from '../db'

/**
 * Password reset email template
 * @param {User} user the user to send the email to
 * @param {string} resetToken the reset token for this email
 * @returns {object} password reset email template
 */
export default function passwordResetEmail ({ user, resetToken }) {
  return {
    to: user.email,
    subject: 'Fuel Rats Password Reset Requested',
    body: {
      name: user.preferredRat().name,
      intro: 'A password reset to your Fuel Rats Account has been requested.',
      action: {
        instructions: 'Click the button below to reset your password:',
        button: {
          color: '#d65050',
          text: 'Reset your password',
          link:  getResetLink(resetToken)
        }
      },
      goToAction: {
        text: 'Reset Password',
        link: getResetLink(resetToken),
        description: 'Click to reset your password'
      },
      outro: 'If you did not request a password reset, no further action is required on your part.',
      signature: 'Sincerely'
    }
  }
}

/**
 * Get a password reset link
 * @param {string} resetToken password reset token
 * @returns {string} password reset link
 */
function getResetLink (resetToken) {
  return `${config.frontend.url}/verify?type=reset&t=${resetToken}`
}
