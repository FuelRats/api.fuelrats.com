/**
 * Email change notification email template
 * @param {object} arg function arguments object
 * @param {string} arg.email the old email to send the notification to
 * @param {string} arg.name name of the email recipient
 * @param {string} arg.newEmail the email that the registered account has been changed to
 * @returns {object} email change email object
 */
export default function emailChangeEmail ({ email, name, newEmail }) {
  return {
    to: email,
    subject: 'Fuel Rats Email has been changed',
    body: {
      name,
      intro: `Your Fuel Rats registered email has been changed to ${newEmail}`,
      outro: 'If this change was not requested by you please contact support@fuelrats.com',
      signature: 'Sincerely'
    }
  }
}
