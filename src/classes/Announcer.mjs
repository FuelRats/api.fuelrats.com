import axios from 'axios'
import crypto from 'crypto'
import config from '../config'

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
    if (!config.announcer.url || !config.announcer.secret) {
      return
    }

    const encodedBody = JSON.stringify({
      channel: destination,
      message,
    })
    const hmacSignature = generateHmacSignature({ contents: encodedBody, key: config.announcer.secret })

    await axios({
      method: 'POST',
      url: config.announcer.url,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Signature': `sha1=${hmacSignature}`,
      },
      data: encodedBody,
    })
  }

  /**
   * Send a message to the rescue back-channel using the announcer
   * @param {string} message the message to send
   * @returns {Promise<undefined>} resolves a promise when completed successfully
   */
  static sendRescueMessage ({ message }) {
    return Announcer.sendMessage({ destination: config.announcer.destinations.rescue, message })
  }

  /**
   * Sends a message to the moderation channel using the announcer
   * @param {string} message the message to send
   * @returns {Promise<undefined>} resolves a promise when completed successfully
   */
  static sendModeratorMessage ({ message }) {
    return Announcer.sendMessage({ destination: config.announcer.destinations.moderation, message })
  }

  /**
   * Sends a message to the network administration channel using the announcer
   * @param {string} message the message to send
   * @returns {Promise<undefined>} resolve a promise when completed successfully
   */
  static sendNetworkMessage ({ message }) {
    return Announcer.sendMessage({ destination: config.announcer.destinations.network, message })
  }

  /**
   * Sends a message to the technical operations channel
   * @param {string} message the message to send
   * @returns {Promise<undefined>} resolves a promise when completed successfully
   */
  static sendTechnicalMessage ({ message }) {
    return Announcer.sendMessage({ destination: config.announcer.destinations.technical, message })
  }

  /**
   * Sends a message to the drill management channel
   * @param {string} message the message to send
   * @returns {Promise<undefined>} resolve a promise when completed successfully
   */
  static sendDrillMessage (message) {
    return Announcer.sendMessage({ destination: config.announcer.destinations.drill, message })
  }
}
