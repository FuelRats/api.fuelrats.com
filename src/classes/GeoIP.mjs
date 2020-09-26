import maxmind from 'maxmind'
import path from 'path'
import config from '../config'

let cityLookup = undefined
let asnLookup = undefined

;(async () => {
  cityLookup = await maxmind.open(path.join(config.geoip.directory, 'GeoLite2-City.mmdb'))
  asnLookup = await maxmind.open(path.join(config.geoip.directory, 'GeoLite2-ASN.mmdb'))

  if (!cityLookup || !asnLookup) {
    throw new Error('Failed to load GeoIP databases')
  }
})()


/**
 * Class for managing GeoIP lookups
 */
export default class GeoIP {
  /**
   * Get GeoIP information about an IP address
   * @param {string} ip the IP address to look up
   * @returns {object} IP lookup information
   */
  static lookup (ip) {
    return { ...cityLookup.get(ip), ...asnLookup.get(ip) }
  }

  /**
   * Get the GeoIP information about an IP address as a string
   * @param {string} ip the ip address to look up
   * @returns {string} geoip information string
   */
  static locationString (ip) {
    const geoip = GeoIP.lookup(ip)
    if (geoip.city && geoip.country) {
      const postal = geoip.postal ? `${geoip.postal.code}, ` : ''
      return `${geoip.city.names.en}, ${postal}${geoip.country.names.en}`
    }
    if (geoip.country) {
      return `Unknown City, ${geoip.country.names.en}`
    }
    return 'Unknown location'
  }
}
