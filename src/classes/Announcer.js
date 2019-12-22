import config from '../config'
import crypto from 'crypto'
import axios from 'axios'

const rescueMessageDestination = '#ratchat'
const moderationMessageDestination = '#rat-ops'
const networkMessageDestination = '#opers'
const technicalMessageDestination = '#rattech'
const drillMessageDestination = '#doersofstuff'

/**
 * Interface to the IRC message announcer
 */
export default class Announcer {
  /**
   * Send a message to an IRC channel using the announcer
   * @param {object} params message parameters object
   * @param {string} params.destination a message destination such as an IRC channel
   * @param {string} params.message the message to send
   * @returns {Promise<undefined>} resolve a promise when completed successfully
   */
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

  /**
   * Send a message to the rescue back-channel using the announcer
   * @param {string} message the message to send
   * @returns {Promise<undefined>} resolves a promise when completed successfully
   */
  static sendRescueMessage ({ message }) {
    return Announcer.sendMessage({ destination:  rescueMessageDestination, message })
  }

  /**
   * Sends a message to the moderation channel using the announcer
   * @param {string} message the message to send
   * @returns {Promise<undefined>} resolves a promise when completed successfully
   */
  static sendModeratorMessage ({ message }) {
    return Announcer.sendMessage({ destination: moderationMessageDestination, message })
  }

  /**
   * Sends a message to the network administration channel using the announcer
   * @param {string} message the message to send
   * @returns {Promise<undefined>} resolve a promise when completed successfully
   */
  static sendNetworkMessage ({ message }) {
    return Announcer.sendMessage({ destination: networkMessageDestination, message })
  }

  /**
   * Sends a message to the technical operations channel
   * @param {string} message the message to send
   * @returns {Promise<undefined>} resolves a promise when completed successfully
   */
  static sendTechnicalMessage (message) {
    return Announcer.sendMessage({ destination: technicalMessageDestination, message })
  }

  /**
   * Sends a message to the drill management channel
   * @param {string} message the message to send
   * @returns {Promise<undefined>} resolve a promise when completed successfully
   */
  static sendDrillMessage (message) {
    return Announcer.sendMessage({ destination: drillMessageDestination, message })
  }
}

/**
 * Generate an HMAC signature for a message
 * @param {object} params parameters object
 * @param {string} params.contents message contents
 * @param {string} params.key hmac secret key
 * @returns {string} an hmac signature for the message
 */
function generateHmacSignature ({ contents, key }) {
  return crypto.createHmac('sha1', key).update(contents).digest('hex')
}
