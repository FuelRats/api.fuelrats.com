import UUID from 'pure-uuid'
import config from '../config'
import * as constants from '../constants'
import { User } from '../db'
import logger from '../logging'
import {
  ForbiddenAPIError,
  NotFoundAPIError,
  TooManyRequestsAPIError,
  UnauthorizedAPIError,
} from './APIError'

import Authentication from './Authentication'
import { Context } from './Context'
import { listen } from './Event'
import Permission from './Permission'
import StatusCode from './StatusCode'
import TrafficControl from './TrafficControl'
import Document from '../Documents/Document'
import ErrorDocument from '../Documents/ErrorDocument'
import Query from '../query/Query'

const maximumMessageLength = 512000

const acceptedProtocols = ['FR-JSONAPI-WS']

const routes = {}

/**
 * Class for managing WebSocket connections using Bun native WebSocket
 */
export default class WebSocket {
  static instance = undefined
  static clients = new Set()

  /**
   * Initialise the WebSocket manager
   * @param {object} arg function arguments object
   * @param {TrafficControl} arg.trafficManager
   */
  constructor ({ trafficManager }) {
    WebSocket.instance = this
    this.traffic = trafficManager

    process.on('apiBroadcast', (id, ctx, result) => {
      this.onBroadcast({ id, ctx, result })
    })
  }

  /**
   * Handle WebSocket upgrade request. Called from Bun.serve() fetch handler.
   * @param {Request} req the HTTP request
   * @param {object} server the Bun server instance
   * @returns {boolean} true if upgraded, false if not a WebSocket request
   */
  static handleUpgrade (req, server) {
    const protocol = req.headers.get('sec-websocket-protocol')
    if (!protocol || !acceptedProtocols.includes(protocol)) {
      return false
    }

    const url = new URL(req.url)
    const bearer = url.searchParams.get('bearer') || req.headers.get('x-bearer')
    const headers = {}
    for (const [key, value] of req.headers) {
      headers[key] = value
    }

    const success = server.upgrade(req, {
      data: {
        url: url.pathname + url.search,
        bearer,
        headers,
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          || server.requestIP(req)?.address
          || '127.0.0.1',
        clientId: new UUID(constants.uuidVersion),
        subscriptions: [],
        user: undefined,
        scope: undefined,
        permissions: undefined,
      },
      headers: {
        'Sec-WebSocket-Protocol': 'FR-JSONAPI-WS',
      },
    })

    return success
  }

  /**
   * Bun WebSocket open handler
   * @param {object} ws Bun WebSocket instance
   */
  async onOpen (ws) {
    WebSocket.clients.add(ws)

    // Authenticate via bearer token
    if (ws.data.bearer) {
      try {
        const result = await Authentication.bearerAuthenticate({ bearer: ws.data.bearer })
        if (result && result.user) {
          ws.data.user = result.user
          ws.data.scope = result.scope
          ws.data.clientId = result.clientId
        }
      } catch {
        // Authentication failed, continue as unauthenticated
      }
    }

    const context = new Context({ client: ws.data, request: {} })
    ws.data.permissions = Permission.getConnectionPermissions({ connection: context })

    // Send connection message with version info
    try {
      const route = WebSocket.getRoute('version', 'read')
      const result = await route(context)

      context.state.traffic = this.traffic.validateRateLimit({ connection: context, increase: false })

      WebSocket.send({
        client: ws,
        message: [
          'connection',
          context.status,
          result.render(),
          {},
        ],
      })
    } catch (error) {
      logger.error({
        GELF: true,
        _event: 'websocket',
      }, `WebSocket connection error: ${error.message}`)
    }
  }

  /**
   * Bun WebSocket message handler
   * @param {object} ws Bun WebSocket instance
   * @param {string|Buffer} message raw message
   */
  async onMessage (ws, message) {
    try {
      const messageStr = String(message)
      if (messageStr.length > maximumMessageLength) {
        ws.close()
        return
      }

      const data = JSON.parse(messageStr)
      await this.handleMessage({ ws, data, message: messageStr })
    } catch (ex) {
      logger.debug({
        GELF: true,
        _event: 'request',
      }, 'Failed to parse incoming websocket message')
    }
  }

  /**
   * Bun WebSocket close handler
   * @param {object} ws Bun WebSocket instance
   */
  onClose (ws) {
    WebSocket.clients.delete(ws)
  }

  /**
   * Handle a parsed WebSocket message
   * @param {object} arg function arguments object
   * @param {object} arg.ws Bun WebSocket instance
   * @param {Array} arg.data parsed message data
   * @param {string} arg.message raw message string
   */
  async handleMessage ({ ws, data, message }) {
    let [state, endpoint, query, body] = data
    if (!state || !endpoint || typeof state !== 'string') {
      ws.close()
      return
    }
    query = query || {}
    body = body || {}

    const ctx = new Context({ client: ws.data, query, body, message })
    ctx.state.user = ws.data.user

    logger.info({
      GELF: true,
      _ip: ctx.request.ip,
      _state: state,
      _endpoint: endpoint.join(':'),
      _query: query,
    }, `Websocket Message by ${ctx.request.ip}`)

    const { representing, permanentDeletion, username, password } = ctx.query

    try {
      if (username && password) {
        const basicUser = await Authentication.basicUserAuthentication({ connection: ctx })
        if (!basicUser) {
          throw new UnauthorizedAPIError({})
        }
        ctx.state.user = basicUser
        ctx.state.basicAuth = true
      }
      if (representing) {
        if (await Authentication.authenticateRepresenting({ ctx, representing }) === false) {
          throw new UnauthorizedAPIError({
            parameter: 'representing',
          })
        }
        delete query.representing
      }

      if (permanentDeletion) {
        if (!ctx.state.basicAuth) {
          throw new ForbiddenAPIError({ parameter: 'permanentDeletion' })
        }

        if (Permission.granted({ connection: ctx, permissions: ['resources.forcedelete'] })) {
          ctx.state.forceDelete = true
        } else {
          throw new ForbiddenAPIError({ parameter: 'permanentDeletion' })
        }
      }
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
        logger.error({
          GELF: true,
          _event: 'request',
          _ip: ctx.request.ip,
          _state: state,
          _endpoint: endpoint.join(':'),
          _query: query,
        }, 'Websocket router received a response from the endpoint that could not be processed')
      }
    } catch (errors) {
      const documentQuery = new Query({ connection: ctx, validate: false })
      const errorDocument = new ErrorDocument({ query: documentQuery, errors })

      ctx.status = errorDocument.httpStatus
      ctx.body = errorDocument.render()
    } finally {
      WebSocket.send({
        client: ws,
        message: [
          state,
          ctx.status,
          ctx.body,
        ],
      })
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
   * @param {User} user the user that caused the event
   * @param {string} id the id of the resource this event relates to
   * @param {object} data event data
   */
  @listen('fuelrats.*')
  onEvent (user, id, data) {
    const clients = [...WebSocket.clients].filter((ws) => {
      return typeof ws.data.user !== 'undefined'
    })

    for (const ws of clients) {
      let document = data ?? {}
      if (document instanceof Document) {
        const context = new Context({ client: ws.data, request: {} })
        document.query = new Query({ connection: context })
        document = document.render()
      }

      WebSocket.send({
        client: ws,
        message: [
          this.event,
          user.id,
          id,
          document,
        ],
      })
    }
  }

  /**
   * Function that receives a broadcast from a third party application and relays it to WebSocket listeners
   * @param {object} arg function arguments object
   * @param {string} arg.event the event name
   * @param {User} arg.sender the user that sent the event
   * @param {object} arg.data event data
   */
  onBroadcast ({ event, sender, data }) {
    const clients = [...WebSocket.clients].filter((ws) => {
      return ws.data.subscriptions.includes(event)
    })
    WebSocket.broadcast({
      clients,
      message: [
        event,
        sender,
        data,
      ],
    })
  }

  /**
   * Send a message to a WebSocket client
   * @param {object} arg function arguments object
   * @param {object} arg.client Bun WebSocket instance
   * @param {object} arg.message message data
   */
  static send ({ client, message }) {
    try {
      client.send(JSON.stringify(message))
    } catch (ex) {
      logger.error({
        GELF: true,
        _event: 'error',
        _message: message,
      }, 'Failed to send websocket message')
    }
  }

  /**
   * Send a message to multiple WebSocket clients
   * @param {object} arg function arguments object
   * @param {object[]} arg.clients Bun WebSocket instances
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
 * TC39 Decorator for routing this method for websocket requests
 * @param {string} route The endpoint name to route websocket requests for
 * @returns {Function} A decorator function
 */
export function websocket (...route) {
  return (method, context) => {
    WebSocket.addRoute({ route, method })
    return method
  }
}
