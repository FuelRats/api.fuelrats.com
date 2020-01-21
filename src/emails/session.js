import config from '../config'
import GeoIP from '../classes/GeoIP'
import UAParser from 'ua-parser-js'

/**
 * Session verification email template
 * @param {object} arg function arguments object
 * @param {string} name the recipient's name
 * @param {string} email the recipient's email
 * @param {string} sessionToken the session token for this verification
 * @param {string} deviceDescription a device description string
 * @param {string} location a user location string
 * @param {string} ipAddress the IP address of the session
 * @returns {object} session email template
 */
export default function sessionEmail ({ ctx, user, sessionToken }) {
  const ipAddress = ctx.request.ip

  const geoip = GeoIP.lookup(ipAddress)
  const location = `${geoip.city.names.en}, ${geoip.postal.code} ${geoip.country.names.en}`
  const deviceDescription = generateDeviceDescription(ctx.state.userAgent)

  return {
    to: user.email,
    subject: 'Fuel Rats: Login from a new location',
    body: {
      name: user.preferredRat().name,
      intro: 'An attempt was made to login to your Fuel Rats account from a new location.',
      action: {
        instructions: 'Click the button below to authorise the login:',
        button: {
          color: '#d65050',
          text: 'Authorise login',
          link:  getVerifyLink(sessionToken)
        }
      },
      goToAction: {
        text: 'Authorise login',
        link: getVerifyLink(sessionToken),
        description: 'Click to authorise the login from a new location'
      },
      dictionary: {
        'Device': deviceDescription,
        'Location': location,
        'IP Address': ipAddress
      },
      outro: 'If this login was not by you then please change your password immediately and contact administrators!',
      signature: 'Sincerely'
    }
  }
}

/**
 * Get a verification link
 * @param {string} verifyToken the verification token
 * @returns {string} a verification link
 */
function getVerifyLink (verifyToken) {
  return `${config.frontend.url}/verify?type=session&t=${verifyToken}`
}

/**
 * Generate a short device description based on a user agent
 * @param {object} userAgent parsed user agent
 * @returns {string} short device description
 */
function generateDeviceDescription (userAgent) {
  const ua = new UAParser(userAgent)
  if (!ua.getBrowser().name) {
    return 'Unknown device'
  }
  return `${ua.getBrowser().name} ${ua.getBrowser().version} on ${ua.getOS().name}`
}
