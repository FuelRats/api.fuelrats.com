import axios from 'axios'
import crypto from 'crypto'
import config from '../config'

const defaultThrottleResetRate = 60 * 60 * 1000 // 1 hour

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
   * @param {object} arg function arguments object
   * @param {string} arg.message the message to send
   * @returns {Promise<undefined>} resolves a promise when completed successfully
   */
  static sendRescueMessage ({ message }) {
    return Announcer.sendMessage({ destination: config.announcer.destinations.rescue, message })
  }

  /**
   * Sends a message to the moderation channel using the announcer
   * @param {object} arg function arguments object
   * @param {string} arg.message the message to send
   * @returns {Promise<undefined>} resolves a promise when completed successfully
   */
  static sendModeratorMessage ({ message }) {
    return Announcer.sendMessage({ destination: config.announcer.destinations.moderation, message })
  }

  /**
   * Sends a message to the network administration channel using the announcer
   * @param {object} arg function arguments object
   * @param {string} arg.message the message to send
   * @returns {Promise<undefined>} resolve a promise when completed successfully
   */
  static sendNetworkMessage ({ message }) {
    return Announcer.sendMessage({ destination: config.announcer.destinations.network, message })
  }

  /**
   * Sends a message to the technical operations channel
   * @param {object} arg function arguments object
   * @param {string} arg.message the message to send
   * @returns {Promise<undefined>} resolves a promise when completed successfully
   */
  static sendTechnicalMessage ({ message }) {
    return Announcer.sendMessage({ destination: config.announcer.destinations.technical, message })
  }

  /**
   * Sends a message to the drill management channel
   * @param {object} arg function arguments object
   * @param {string} arg.message the message to send
   * @returns {Promise<undefined>} resolve a promise when completed successfully
   */
  static sendDrillMessage ({ message }) {
    return Announcer.sendMessage({ destination: config.announcer.destinations.drill, message })
  }
}

/**
 * A class to help manage announcer message throttling
 */
export class ThrottledAnnouncer {
  #method = () => {}

  /**
   * @param {object} arg function arguments object
   * @param {number} arg.resetRate Rate at which to reset the key list (Default: 1 Hour)
   * @param {Function} arg.method function to call when a message is sent
   */
  constructor ({ resetRate = defaultThrottleResetRate, method = Announcer.sendMessage }) {
    this.resetRate = resetRate
    this.#method = method
    this.reset()
  }

  /**
   * @returns {boolean} value indicating whether the current key list is stale and should be reset
   */
  get isStale () {
    return Date.now() >= this.resetDate.getTime()
  }

  /**
   * Resets the current key list and sets a new reset date
   */
  reset () {
    this.messageKeys = {}
    this.resetDate = new Date(Math.ceil(Date.now() / this.resetRate) * this.resetRate)
  }

  /**
   * Sends a message if it hasn't been sent within the throttle period already.
   * @param {object} arg function arguments object
   * @param {string} arg.message the message to send
   * @param {string?} arg.key string representing the value of an announcement message
   * @param {string?} arg.destination a message destination such as an IRC channel (may not be required for provided announcer function)
   * @returns {Promise<undefined>}
   */
  sendMessage ({ key, message, destination }) {
    if (this.isStale) {
      this.reset()
    }
    const msgKey = key ?? message

    if (this.messageKeys[msgKey]) {
      return Promise.resolve()
    }

    this.messageKeys[msgKey] = true
    return this.#method({ message, destination })
  }
}
