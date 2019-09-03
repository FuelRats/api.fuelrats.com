import maxmind from 'maxmind'

let cityLookup = undefined
let asnLookup = undefined

export default class GeoIP {
  static lookup (ip) {
    return { ...cityLookup.get(ip), ...asnLookup.get(ip) }
  }
}

(async function () {
  cityLookup = await maxmind.open('static/geoip/GeoLite2-City.mmdb')
  asnLookup = await maxmind.open('static/geoip/GeoLite2-ASN.mmdb')
}())
