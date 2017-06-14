'use strict'
const TrafficControl = require('../TrafficControl')
const Error = require('../errors')
let traffic = new TrafficControl()

class API {
  /**
   * Express.js middleware to route a request to a websocket compatible API endpoint
   * @param {Function} route - The API endpoint to route to
   * @returns {Function} Express.js routing middleware
   */
  static route (route) {
    return function (request, response, next) {
      let rateLimit = traffic.validateRateLimit(request)

      response.header('X-API-Version', request.version)
      response.header('X-Rate-Limit-Limit', rateLimit.total)
      response.header('X-Rate-Limit-Remaining', rateLimit.remaining)
      response.header('X-Rate-Limit-Reset', traffic.nextResetDate)

      if (rateLimit.exceeded) {
        return next(Error.throw('rate_limit_exceeded'))
      }

      let params = Object.assign(request.query, request.params)

      route(params, request, request.body).then(function (result) {
        response.status(200).send({
          links: {
            self: request.originalUrl
          },
          meta: {
            method: request.method,
            params: Object.assign(request.query, request.params),
            timestamp: new Date().toISOString()
          },
          data: result
        })
      }).catch(function (error) {
        next(error)
      })
    }
  }

  static version (version) {
    return function (req, res, next) {
      req.version = version
      next()
    }
  }
}

module.exports = API
