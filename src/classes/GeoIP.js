import maxmind from 'maxmind'

let cityLookup = undefined
let asnLookup = undefined

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
}

(async function () {
  cityLookup = await maxmind.open('static/geoip/GeoLite2-City.mmdb')
  asnLookup = await maxmind.open('static/geoip/GeoLite2-ASN.mmdb')
}())
