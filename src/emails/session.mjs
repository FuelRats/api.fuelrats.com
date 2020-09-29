import UAParser from 'ua-parser-js'
import GeoIP from '../classes/GeoIP'

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


/**
 * Session verification email template
 * @param {object} arg function arguments object
 * @param {string} arg.name the recipient's name
 * @param {string} arg.email the recipient's email
 * @param {string} arg.sessionToken the session token for this verification
 * @param {string} arg.deviceDescription a device description string
 * @param {string} arg.location a user location string
 * @param {string} arg.ipAddress the IP address of the session
 * @returns {object} session email template
 */
export default function sessionEmail ({ ctx, user, sessionToken }) {
  const ipAddress = ctx.request.ip

  const location = GeoIP.locationString(ipAddress)
  const deviceDescription = generateDeviceDescription(ctx.state.userAgent)

  return {
    to: user.email,
    subject: 'Fuel Rats: Login from a new location',
    template: 'session',
    params: {
      name: user.preferredRat().name,
      token: sessionToken.toUpperCase(),
      device: deviceDescription,
      location,
      ipAddress,
    },
  }
}
