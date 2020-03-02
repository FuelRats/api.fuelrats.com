import axios from 'axios'
import { URLSearchParams } from 'url'
import config from '../config'

/**
 * Class for managing Frontier API related functions
 */
export default class FrontierAPI {
  /**
   * Exchange a token on the frontier API
   * @param {string} code oauth code
   * @returns {Promise<any>} result data
   */
  static async exchangeToken (code) {
    const params = new URLSearchParams()
    params.append('code', code)
    params.append('client_id', config.frontier.clientId)
    params.append('client_secret', config.frontier.sharedKey)
    params.append('redirect_uri', config.frontier.redirectUri)
    params.append('grant_type', 'authorization_code')

    const result = await axios({
      method: 'POST',
      url: 'https://auth.frontierstore.net/token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: params,
    })

    return result.data
  }

  /**
   * Retrieve a Frontier Profile
   * @param {string} token Frontier API token
   * @returns {Promise<object>} Frontier profile result
   */
  static async getProfile (token) {
    const [user, profile] = await Promise.all([
      axios.get('https://auth.frontierstore.net/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
      axios.get('https://companion.orerve.net/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
    ])

    return { ...user.data, ...profile.data }
  }
}
