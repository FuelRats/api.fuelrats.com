import config from '../../config'
import crypto from 'crypto'
import axios from 'axios'

const rescueMessageDestination = '#ratchat'
const moderationMessageDestination = '#rat-ops'
const networkMessageDestination = '#opers'
const technicalMessageDestination = '#rattech'
const drillMessageDestination = '#doersofstuff'

export default class Announcer {
  static async sendMessage ({ destination, message }) {
    const encodedBody = JSON.stringify({
      channel: destination,
      message
    })
    const hmacSignature = generateHmacSignature({ contents: encodedBody, key: config.announcer.secret })

    await axios({
      method: 'POST',
      url: config.announcer.url,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Signature': `sha1=${hmacSignature}`
      },
      data: encodedBody
    })
  }

  static sendRescueMessage ({ message }) {
    return Announcer.sendMessage({ destination:  rescueMessageDestination, message })
  }

  static sendModeratorMessage ({ message }) {
    return Announcer.sendMessage({ destination: moderationMessageDestination, message })
  }

  static sendNetworkMessage ({ message }) {
    return Announcer.sendMessage({ destination: networkMessageDestination, message })
  }

  static sendTechnicalMessage (message) {
    return Announcer.sendMessage({ destination: technicalMessageDestination, message })
  }

  static sendDrillMessage (message) {
    return Announcer.sendMessage({ destination: drillMessageDestination, message })
  }
}


function generateHmacSignature ({ contents, key }) {
  return crypto.createHmac('sha1', key).update(contents).digest('hex')
}
