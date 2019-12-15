/* eslint-disable */
import logger from '../logging'
import {
  APIError,
  InternalServerError,
  NotFoundAPIError,
  TooManyRequestsAPIError
} from './APIError'
import ws from 'ws'

import { URL } from 'url'
import UUID from 'pure-uuid'
import Authentication from './Authentication'
import Permission from './Permission'
import Document from '../Documents/Document'
import { Context } from './Context'

const acceptedProtocols = ['FR-JSONAPI-WS']

const routes = {}

// eslint-disable-next-line
export default class WebSocket {
  constructor ({ server, trafficManager }) {
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
      console.log(client, req)

      const url = new URL(`http://localhost:8082${req.url}`)
      client.req = req
      client.clientId = new UUID(4)
      client.subscriptions = []

      const bearer = url.searchParams.get('bearer')
      if (bearer) {
        const { user, scope } = await Authentication.bearerAuthenticate({ bearer })
        if (user) {
          client.user = user
          client.scope = scope
        }
      }

      await this.onConnection({ client })

      client.on('message', (message) => {
        try {
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
    })
  }

  async onConnection ({ client }) {
    // noinspection JSClosureCompilerSyntax
    const ctx = new Context({ client, request: {} })
    const route = await WebSocket.getRoute('version', 'read')
    const result = await route(ctx)

    ctx.state.traffic = this.traffic.validateRateLimit(ctx, false)
    WebSocket.send({ client, message: result })
  }

  async onMessage ({ client, data, message }) {
    try {
      let [state, endpoint, query, body] = data
      if (!state || endpoint) {
        client.terminate()
        return
      }
      query = query || {}
      body = body || {}

      // noinspection JSClosureCompilerSyntax
      const ctx = new Context({ client, query, body, message })

      let result = await this.route({ ctx, endpoint })
      if (result instanceof Document) {
        result = result.toString()
      }

      WebSocket.send({ client, message: result })
    } catch (ex) {
      let errors = ex

      if (errors.hasOwnProperty('name')) {
        errors = APIError.fromValidationError(errors)
      }

      if (Array.isArray(errors) === false) {
        errors = [errors]
      }

      errors = errors.map((error) => {
        if ((error instanceof APIError) === false) {
          return new InternalServerError({})
        }
        return error
      })

      WebSocket.send({ client, message: errors })
    }
  }

  route ({ ctx, endpoint }) {
    const rateLimit = this.traffic.validateRateLimit({ connection: ctx })
    ctx.state.traffic = rateLimit
    if (rateLimit.exceeded) {
      throw new TooManyRequestsAPIError({})
    }

    const route = WebSocket.getRoute(...endpoint)
    return route(ctx)
  }

  onBroadcast ({ id, result }) {
    const clients = [...this.wss.clients].filter((client) => {
      return client.subscriptions.includes(id)
    })
    WebSocket.broadcast({ clients, message: result })
  }

  onEvent (event, ctx, result, permissions = undefined) {
    const clients = [...this.wss.clients].filter((client) => {
      if (client.clientId !== ctx.client.clientId) {
        return (!permissions || Permission.granted({ permissions, connection: ctx }))
      }
      return false
    })
    if (!result.meta) {
      result.meta = {}
    }

    Object.assign(result.meta, { event })
    WebSocket.broadcast({ clients, message: result })
  }

  static send ({ client, message }) {
    try {
      client.send(JSON.stringify(message))
    } catch (ex) {
      logger.info('Failed to send websocket message')
    }
  }

  static broadcast ({ clients, message }) {
    for (const client of clients) {
      WebSocket.send({ client, message })
    }
  }

  static addRoute ({ route, method }) {
    const routeIdentifier = route.join(':')

    routes[routeIdentifier] = method
  }

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
