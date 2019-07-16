import { URLSearchParams } from 'url'
import config from '../../config'
import axios from 'axios'

export default class FrontierAPI {
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
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: params
    })

    return result.data
  }

  static async getProfile (token) {
    const [user, profile] = await Promise.all([
      axios.get('https://auth.frontierstore.net/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }),
      axios.get('https://companion.orerve.net/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
    ])

    return { ...user.data, ...profile.data }
  }
}
