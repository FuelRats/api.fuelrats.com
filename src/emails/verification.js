import config from '../config'
import { User } from '../db'

/**
 * Verification email template
 * @param {object} arg function arguments object
 * @param {User} arg.user
 * @param {string} verificationToken the verification token for this request
 * @param {boolean} [change] Whether this email is for a change to an existing account
 * @returns {object} verification email object
 */
export default function verificationEmail ({ user, verificationToken, change = false }) {
  let intro = 'To complete the creation of your Fuel Rats Account your email address needs to be verified.'
  if (change) {
    intro = 'To complete your email change your email address needs to be verified.'
  }

  return {
    to: user.email,
    subject: 'Fuel Rats Email Verification Required',
    body: {
      name: user.preferredRat().name,
      intro,
      action: {
        instructions: 'Click the button below to verify your email:',
        button: {
          color: '#d65050',
          text: 'Verify me',
          link:  getVerifyLink(verificationToken)
        }
      },
      goToAction: {
        text: 'Verify Email Address',
        link: getVerifyLink(verificationToken),
        description: 'Click to verify your email'
      },
      outro: 'If you are having problems with verification you may contact support@fuelrats.com',
      signature: 'Sincerely'
    }
  }
}

/**
 * Generate a verification link from a reset token
 * @param {string} resetToken the reset token
 * @returns {string} a verification link
 */
function getVerifyLink (resetToken) {
  return `${config.frontend.url}/verify?type=email&t=${resetToken}`
}
