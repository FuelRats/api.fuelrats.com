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
          link:  getVerifyLink(verificationToken, change)
        }
      },
      goToAction: {
        text: 'Verify Email Address',
        link: getVerifyLink(verificationToken, change),
        description: 'Click to verify your email'
      },
      outro: 'If you are having problems with verification you may contact support@fuelrats.com',
      signature: 'Sincerely'
    }
  }
}

/**
 * Generate a verification link from a verification token
 * @param {string} verificationToken the verification token
 * @param {boolean} change whether this is a change to an existing account
 * @returns {string} a verification link
 */
function getVerifyLink (verificationToken, change) {
  return `${config.frontend.url}/verify?type=email&t=${verificationToken}&change=${change}`
}
