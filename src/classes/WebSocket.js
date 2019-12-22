import logger from '../logging'
import {
  NotFoundAPIError,
  TooManyRequestsAPIError
} from './APIError'
import ws from 'ws'
import config from '../config'
import { User } from '../db'

import { URL } from 'url'
import UUID from 'pure-uuid'
import Authentication from './Authentication'
import Permission from './Permission'
import Document from '../Documents/Document'
import { Context } from './Context'
import TrafficControl from './TrafficControl'
import StatusCode from './StatusCode'
import Query from '../query/Query'
import ErrorDocument from '../Documents/ErrorDocument'
import { listen } from '../classes/Event'

const maximumMessageLength = 512000

const acceptedProtocols = ['FR-JSONAPI-WS']

const routes = {}

let singleton = undefined

/**
 * Class for managing WebSocket connections
 */
export default class WebSocket {
  /**
   * Initialise a new websocket server
   * @param {object} arg function arguments object
   * @param {any} arg.server WebSocket server connection object
   * @param {TrafficControl} arg.trafficManager
   */
  constructor ({ server, trafficManager }) {
    if (singleton) {
      return singleton
    }

    this.wss = new ws.Server({
      server,
      clientTracking: true,
      handleProtocols: () => {
        return acceptedProtocols
      }
    })

    this.wss.shouldHandle = (request) => {
      const requestedProtocol = request.headers['sec-websocket-protocol']
      if (!requestedProtocol) {
        return false
      }
      return acceptedProtocols.includes(requestedProtocol)
    }
    this.traffic = trafficManager

    this.wss.on('connection', async (client, req) => {
      client.req = req
      client.clientId = new UUID(4)
      client.subscriptions = []


      const url = new URL(`${config.server.externalUrl}${req.url}`)
      const bearer = url.searchParams.get('bearer')
      if (bearer) {
        const { user, scope, clientId } = await Authentication.bearerAuthenticate({ bearer })
        if (user) {
          client.user = user
          client.scope = scope
          client.clientId = clientId
        }
      }

      // noinspection JSClosureCompilerSyntax
      const context = new Context({ client, request: {} })
      client.permissions = Permission.getConnectionPermissions({ connection: context })

      await this.onConnection({ ctx: context, client })

      client.on('message', (message) => {
        try {
          if (message.length > maximumMessageLength) {
            client.terminate()
          }

          const data = JSON.parse(String(message))
          return this.onMessage({ client, data, message })
        } catch (ex) {
          logger.info('Failed to parse incoming websocket message')
          return undefined
        }
      })

      process.on('apiBroadcast', (id, ctx, result) => {
        this.onBroadcast({ id, ctx, result })
      })


      // eslint-disable-next-line consistent-this
      singleton = this
    })
  }

  /**
   * Singleton instance of the WebSocket service
   * @returns {WebSocket} websocket instance
   */
  static get instance () {
    return singleton
  }

  /**
   * On websocket connection event
   * @param {object} arg function arguments object
   * @param {Context} arg.ctx request context
   * @param {ws.Client} arg.client websocket client
   * @returns {Promise<void>} resolves promise when completed
   */
  async onConnection ({ ctx, client }) {
    const route = await WebSocket.getRoute('version', 'read')
    const result = await route(ctx)

    ctx.state.traffic = this.traffic.validateRateLimit({ connection: ctx, increase: false })

    WebSocket.send({ client, message: [
      'connection',
      ctx.status,
      result.render()
    ] })
  }

  /**
   * On WebSocket message event
   * @param {object} arg function arguments object
   * @param {ws.Client} arg.client
   * @param {object} arg.data
   * @param {object} arg.message
   * @returns {Promise<void>}
   */
  async onMessage ({ client, data, message }) {
    let [state, endpoint, query, body] = data
    if (!state || !endpoint || typeof state !== 'string') {
      client.terminate()
      return
    }
    query = query || {}
    body = body || {}

    // noinspection JSClosureCompilerSyntax
    const ctx = new Context({ client, query, body, message })
    const { representing } = ctx.query
    if (representing) {
      await Authentication.authenticateRepresenting({ ctx, representing })
      delete query.representing
    }

    try {
      const result = await this.route({ ctx, endpoint })
      if (result === true) {
        ctx.status = StatusCode.noContent
        ctx.body = {}
      } else if (result instanceof Document) {
        ctx.type = 'application/vnd.api+json'
        ctx.body = result.render()
      } else if (result) {
        ctx.body = result
      } else {
        logger.error('Websocket router received a response from the endpoint that could not be processed')
      }
    } catch (errors) {
      const documentQuery = new Query({ connection: ctx })
      const errorDocument = new ErrorDocument({ query: documentQuery, errors })

      ctx.status = errorDocument.httpStatus
      ctx.body = errorDocument.render()
    } finally {
      WebSocket.send({ client, message: [
        state,
        ctx.status,
        ctx.body
      ] })
    }
  }

  /**
   * WebSocket routing function
   * @param {object} arg function arguments object
   * @param {Context} arg.ctx
   * @param {Function} arg.endpoint
   * @returns {*}
   */
  route ({ ctx, endpoint }) {
    const rateLimit = this.traffic.validateRateLimit({ connection: ctx })
    ctx.state.traffic = rateLimit
    if (rateLimit.exceeded) {
      throw new TooManyRequestsAPIError({})
    }

    const route = WebSocket.getRoute(...endpoint)
    return route(ctx)
  }

  /**
   * Event listener for fuelrats api change events that should be broadcasted to websocket
   * @param {User} user the user that caused the vent
   * @param {object} data event data
   */
  @listen('fuelrats.*')
  onEvent (user, data) {
    const clients = [...WebSocket.instance.wss.clients].filter((client) => {
      return typeof client.user !== 'undefined'
    })

    WebSocket.broadcast({ clients, message: [
      this.event,
      user.id,
      data
    ] })
  }

  /**
   * Function that receives a broadcast from a third party application and relays it to WebSocket listeners
   * @param {object} arg function arguments object
   * @param {string} arg.event the event name
   * @param {User} arg.sender the user that sent the event
   * @param {object} arg.data event data
   */
  onBroadcast ({ event, sender, data }) {
    const clients = [...this.wss.clients].filter((client) => {
      return client.subscriptions.includes(event)
    })
    WebSocket.broadcast({ clients, message: [
      event,
      sender,
      data
    ] })
  }

  /**
   * Send a message to a WebSocket client
   * @param {object} arg function arguments object
   * @param {ws.Client} arg.client websocket client
   * @param {object} arg.message message data
   */
  static send ({ client, message }) {
    try {
      client.send(JSON.stringify(message))
    } catch (ex) {
      logger.info('Failed to send websocket message')
    }
  }

  /**
   * Send a message to multiple WebSocket clients
   * @param {object} arg function arguments object
   * @param {[ws.Client]} arg.clients websocket client list
   * @param {object} arg.message message data
   */
  static broadcast ({ clients, message }) {
    const json = JSON.stringify(message)
    for (const client of clients) {
      client.send(json)
    }
  }

  /**
   * Add a route to the WebSocket router
   * @param {object} arg function arguments object
   * @param {[string]} arg.route the route path
   * @param {Function} arg.method the function to route to
   */
  static addRoute ({ route, method }) {
    const routeIdentifier = route.join(':')

    routes[routeIdentifier] = method
  }

  /**
   * Get a route function from a route
   * @param {...string} route route path
   * @returns {Function|undefined} route function
   */
  static getRoute (...route) {
    const routeIdentifier = route.join(':')
    if (Object.prototype.hasOwnProperty.call(routes, routeIdentifier) === false) {
      throw new NotFoundAPIError({ parameter: 'action' })
    }
    return routes[routeIdentifier]
  }
}


/**
 * ESNext Decorator for routing this method for websocket requests
 * @param {string} route The endpoint name to route websocket requests for
 * @returns {Function} An ESNext decorator function
 */
export function websocket (...route) {
  return function (target, name, descriptor) {
    WebSocket.addRoute({ route, method: descriptor.value })
  }
}
