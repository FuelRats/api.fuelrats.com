import net from 'net'
import { NotFoundAPIError, UnprocessableEntityAPIError } from '../classes/APIError'
import GeoIP from '../classes/GeoIP'
import { websocket } from '../classes/WebSocket'
import API, { GET, parameters, permissions } from './API'

/**
 * Endpoints for requesting any API error to be thrown, for usage by clients for testing.
 */
export default class IPLookups extends API {
  /**
   * Endpoint for requesting a specific API error be thrown by name
   * @endpoint
   */
  @GET('/geoip/:ip')
  @websocket('geoip', 'read')
  @parameters('ip')
  @permissions('users.read')
  read (ctx) {
    const { ip } = ctx.params

    if (net.isIP(ip) === 0) {
      throw new UnprocessableEntityAPIError({ parameter: 'ip' })
    }

    const geoip = GeoIP.lookup(ip)
    if (!geoip.country) {
      throw new NotFoundAPIError({ parameter: 'ip' })
    }
    return {
      asn: geoip.autonomous_system_number,
      organisation: geoip.autonomous_system_organization,
      organisationCountryCode: geoip?.registered_country?.iso_code,
      organisationCountry: geoip?.registered_country?.names?.en,
      city: geoip?.city?.names?.en,
      continent: geoip?.continent?.names?.en,
      countryCode: geoip?.country?.iso_code,
      country: geoip?.country?.names?.en,
      postal: geoip?.postal?.code,
      lat: geoip?.location?.latitude,
      lon: geoip?.location?.longitude,
      accuracy: geoip?.location?.accuracy,
    }
  }

  /**
   * @inheritdoc
   */
  get type () {
    return 'geoip-lookups'
  }
}

