import logger from '../loggly/logger'
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
import config from '../../config'
import Document from '../Documents/Document'

const acceptedProtocols = ['FR-JSONAPI-WS']

const routes = {}

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
        return (!permissions || Permission.granted({ permissions, ...client }))
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

export class Request {
  constructor ({ client, query, body, message }) {
    const url = new URL(`${config.externalUrl}${client.req.url}`)

    this.header = client.req.headers
    this.headers = client.req.headers
    this.method = client.req.method
    this.length = message.length
    this.url = client.req.url
    this.originalUrl = client.req.url
    this.origin = url.origin
    this.href = url.href
    this.path = url.pathname
    this.querystring = url.search
    this.search = url.search
    this.host = url.host
    this.hostname = url.hostname
    this.URL = url
    this.type = undefined
    this.charset = undefined
    this.query = query
    this.body = body
    this.fresh = true
    this.state = false
    this.protocol = 'https'
    this.secure = true
    this.ip = client.req.headers['x-forwarded-for'] || client.req.connection.remoteAddress
    this.ips = [client.req.headers['x-forwarded-for'], client.req.connection.remoteAddress]
    this.subdomains = url.hostname.split('.')
    this.is = () => {
      return false
    }
    this.socket = client.req.socket
    this.get = (header) => {
      return client.req.headers[header.toLowerCase()]
    }
  }
}

export class Response {
  constructor ({ client }) {
    this.header = {}
    this.headers = this.header
    this.socket = client.req.socket
    this.status = 404
    this.message = undefined
    this.length = 0
    this.body = undefined
    this.get = () => {
      return undefined
    }
    this.set = (field, value) => {
      this.header[field] = value
    }

    this.append = (field, value) => {
      this.header[field] = value
    }

    this.remove = (field) => {
      delete this.header[field]
    }

    this.type = undefined
    this.is = () => {
      return false
    }
  }
}

export class Context {
  constructor ({ client, query, body, message }) {
    const request = new Request({ client, query, body, message })
    const response = new Response({ client })
    this.client = client

    this.req = client.req
    this.res = client.req
    this.request = request
    this.response = response

    this.state = {}
    this.state.scope = client.scope
    this.state.user = client.user
    this.state.userAgent = client.req.headers['user-agent']

    this.app = {}
    this.cookies = {
      get: () => {
        return undefined
      },
      set: () => {}

    }

    this.header = request.header
    this.headers = request.headers
    this.method = request.method
    this.url = request.url
    this.originalUrl = request.originalUrl
    this.origin = request.origin
    this.href = request.href
    this.path = request.path
    this.query = request.query
    this.querystring = request.querystring
    this.host = request.host
    this.hostname = request.hostname
    this.fresh = request.fresh
    this.stale = request.stale
    this.socket = request.socket
    this.protocol = request.protocol
    this.secure = request.secure
    this.ip = request.ip
    this.subdomains = request.subdomains
    this.is = request.is
    this.get = request.get
    this.data = request.body

    this.body = response.body
    this.status = response.status
    this.message = response.message
    this.length = response.length
    this.type = response.type
  }
}


/**
 * ESNext Decorator for routing this method for websocket requests
 * @param endpointName The endpoint name to route websocket requests for
 * @param methodName The method name to route websocket requests for
 * @returns {Function} An ESNext decorator function
 */
export function websocket (endpointName, methodName) {
  return function (target, name, descriptor) {
    WebSocket.addRoute({ endpointName, methodName, method: descriptor.value })
  }
}
