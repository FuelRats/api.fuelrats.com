import UUID from 'pure-uuid'
import { URL } from 'url'
import { WebSocketServer } from 'ws'
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
 * Class for managing WebSocket connections
 */
export default class WebSocket {
  static instance = undefined
  /**
   * Initialise a new websocket server
   * @param {object} arg function arguments object
   * @param {any} arg.server WebSocket server connection object
   * @param {TrafficControl} arg.trafficManager
   */
  constructor ({ server, trafficManager }) {
    WebSocket.instance = this
    WebSocket.wss = new WebSocketServer({
      server,
      clientTracking: true,
      handleProtocols: () => {
        return acceptedProtocols
      },
    })

    WebSocket.wss.shouldHandle = (request) => {
      const requestedProtocol = request.headers['sec-websocket-protocol']
      if (!requestedProtocol) {
        return false
      }
      return acceptedProtocols.includes(requestedProtocol)
    }
    this.traffic = trafficManager

    WebSocket.wss.on('connection', async (client, req) => {
      client.req = req
      client.clientId = new UUID(constants.uuidVersion)
      client.subscriptions = []


      const url = new URL(`${config.server.externalUrl}${req.url}`)
      let bearer = url.searchParams.get('bearer')
      if (!bearer) {
        bearer = req.headers['x-bearer']
      }
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
          logger.debug({
            GELF: true,
            _event: 'request',
            _message: message,
          }, 'Failed to parse incoming websocket message')
          return undefined
        }
      })

      process.on('apiBroadcast', (id, ctx, result) => {
        this.onBroadcast({ id, ctx, result })
      })
    })
  }

  /**
   * On websocket connection event
   * @param {object} arg function arguments object
   * @param {Context} arg.ctx request context
   * @param {WebSocketServer.Client} arg.client websocket client
   * @returns {Promise<void>} resolves promise when completed
   */
  async onConnection ({ ctx, client }) {
    const route = await WebSocket.getRoute('version', 'read')
    const result = await route(ctx)

    ctx.state.traffic = this.traffic.validateRateLimit({ connection: ctx, increase: false })

    WebSocket.send({
      client,
      message: [
        'connection',
        ctx.status,
        result.render(),
        {},
      ],
    })
  }

  /**
   * On WebSocket message event
   * @param {object} arg function arguments object
   * @param {WebSocketServer.Client} arg.client
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
    ctx.state.user = client.user

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
        client,
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
   * @param {User} user the user that caused the vent
   * @param {string} id the id of the resource this event relates to
   * @param {object} data event data
   */
  @listen('fuelrats.*')
  onEvent (user, id, data) {
    const clients = [...WebSocket.wss.clients].filter((client) => {
      return typeof client.user !== 'undefined'
    })

    for (const client of clients) {
      let document = data ?? {}
      if (document instanceof Document) {
        const context = new Context({ client, request: {} })
        document.query = new Query({ connection: context })
        document = document.render()
      }

      WebSocket.send({
        client,
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
    const clients = [...WebSocket.wss.clients].filter((client) => {
      return client.subscriptions.includes(event)
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
   * @param {WebSocketServer.Client} arg.client websocket client
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
   * @param {[WebSocketServer.Client]} arg.clients websocket client list
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
  return (target, name, descriptor) => {
    WebSocket.addRoute({ route, method: descriptor.value })
  }
}
