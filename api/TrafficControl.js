'use strict'
const Permissions = require('./permission')

const HOUR_TIMER = 60 * 60 * 1000

const allowedUnauthenticatedRequestCount = 360
const allowedAuthenticatedRequestCount = 3600
const allowedAdminRequestCount = 10000


/**
 * Class for managing the rate of traffic from IP addresses and users
 */
class TrafficControl {
  /**
   * Create a new instance of a Traffic Controller with fresh hash tables and reset clock
   * @constructor
   */
  constructor () {
    this._reset()
  }

  /**
   *
   * @param {Object} connection - A websocket client or Express.js request object
   * @param {boolean} increase - Whether this validation should also increase the request count by 1
   * @returns {Object} - An object containing whether the rate limit is exceeded, how many requests are left,
   * and the total requests
   */
  validateRateLimit (connection, increase = true) {
    let entity
    if (connection.state.user && connection.state.user.data.type === 'users') {
      entity = this.retrieveAuthenticatedEntity(connection.state.user)
    } else {
      entity = this.retrieveUnauthenticatedEntity(connection.inet)
    }

    let valid = entity.remainingRequests > 0
    if (valid && increase) {
      entity.count += 1
    }
    return {
      exceeded: !valid,
      remaining: entity.remainingRequests,
      total: entity.totalRequests
    }
  }

  /**
   * Retrieve an authenticated entity with the number of requests made by this user, or create one
   * @param {Object} user - The user associated with this request
   * @returns {Object} An instance of AuthenticatedUserEntity
   */
  retrieveAuthenticatedEntity (user) {
    let entity = this.authenticatedRequests[user.id]
    if (!entity) {
      entity = new AuthenticatedUserEntity(user)
      this.authenticatedRequests[user.id] = entity
    }
    return entity
  }

  /**
   * Retrieve an unauthenticated entity with the number of requests made by this IP address, or create one
   * @param {string} remoteAddress - The remote address associated with this request
   * @returns {Object} an instance of RemoteAddressEntity
   */
  retrieveUnauthenticatedEntity (remoteAddress) {
    let entity = this.unauthenticatedRequests[remoteAddress]
    if (!entity) {
      entity = new RemoteAddressEntity(remoteAddress)
      this.unauthenticatedRequests[remoteAddress] = entity
    }
    return entity
  }

  /**
   * Get the next time all rate limits will be reset (The next full hour)
   * @returns {Date} A date object containing the next time all rate limits will be reset
   */
  get nextResetDate () {
    return new Date(Math.ceil(new Date().getTime() / HOUR_TIMER) * HOUR_TIMER)
  }

  /**
   * Get the remaining milliseconds until the next time all rate limits will be reset (the next full hour)
   * @returns {number} A number with the number of milliseconds until the next rate limit reset
   * @private
   */
  get _remainingTimeToNextResetDate () {
    return this.nextResetDate.getTime() - new Date().getTime()
  }

  /**
   * Reset all rate limits
   * @private
   */
  _reset () {
    this.authenticatedRequests = {}
    this.unauthenticatedRequests = {}
    this._resetTimer = setTimeout(this._reset.bind(this), this._remainingTimeToNextResetDate)
  }
}

/**
 * Base class representing a request traffic entity
 */
class TrafficEntity {
  /**
   * Get the number of requests made by this entity during the rate limit period
   * @returns {number} number of requests made by this entity during the rate limit period
   */
  get count () {
    return this._requestCount
  }

  /**
   * Set the number of requests made by this entity during the rate limit period
   * @param {number} count The number of requests made by this entity during the rate limit period
   */
  set count (count) {
    this._requestCount =  count
  }
}

/**
 * Class representing an authenticated user containing their requests the last clock hour
 */
class AuthenticatedUserEntity extends TrafficEntity {
  /**
   * Create an entity representing the traffic made by a specific authenticated user
   * @constructor
   * @param {Object} user - The user object of the authenticated user this traffic belongs to
   * @param {number} initialCount - Optional parameter containing the number of requests this entity should start with
   */
  constructor (user, initialCount = 0) {
    super()
    this._user = user
    this._requestCount = initialCount
  }

  /**
   * Whether the authenticated user this entity belongs to is an admin
   * @returns {boolean} true if the authenticated user this entity belongs to is an admin
   */
  get isAdmin () {
    return Permissions.groups.find((group) => {
      return group.isAdministrator && this._user.data.relationships.groups.data.find((uGroup) => {
        return uGroup.id === group.id
      })
    })
  }

  /**
   * Get the number of remaining requests this entity has in this period
   * @returns {number} the number of remaining requests this entity has in this period
   */
  get remainingRequests () {
    if (this.isAdmin) {
      return allowedAdminRequestCount - this._requestCount
    }
    return allowedAuthenticatedRequestCount - this._requestCount
  }

  get totalRequests () {
    if (this.isAdmin) {
      return allowedAdminRequestCount
    }
    return allowedAuthenticatedRequestCount
  }
}

/**
 *  Class representing an unauthenticated remote address containing their requests the last clock hour
 */
class RemoteAddressEntity extends TrafficEntity {
  /**
   * Create an entity representing the traffic made by a specific unauthenticated remote address
   * @param {string} remoteAddress - The remote address this traffic belongs to
   * @param initialCount - Optional parameter containing the number ofrequests this entity should start with
   */
  constructor (remoteAddress, initialCount = 0) {
    super()
    this._remoteAddress = remoteAddress
    this._requestCount = initialCount
  }

  /**
   * Get the number of remaining requests this entity has in this period
   * @returns {number} the number of remaining requests this entity has in this period
   */
  get remainingRequests () {
    return allowedUnauthenticatedRequestCount - this.count
  }

  get totalRequests () {
    return allowedUnauthenticatedRequestCount
  }
}

module.exports = TrafficControl