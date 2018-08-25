import logger from '../loggly/logger'
import {
  APIError,
  InternalServerError,
  NotFoundAPIError
} from './APIError'
import ws from 'ws'

import { URL } from 'url'
import uid from 'uid-safe'
import Authentication from './Authentication'
import Permission from './Permission'
import Meta from './Meta'

const PRETTY_PRINT_SPACING = 2

const apiEvents = [
  'rescueCreated',
  'rescueUpdated',
  'rescueDeleted',
  'ratCreated',
  'ratUpdated',
  'ratDeleted',
  'userCreated',
  'userUpdated',
  'userDeleted',
  'shipCreated',
  'shipUpdated',
  'shipDeleted',
  'connection'
]

const routes = {}

export default class WebSocket {
  constructor ({server, trafficManager}) {
    this.wss = new ws.Server({server})
    this.traffic = trafficManager

    this.wss.on('connection', async (client, req) => {
      let url = new URL(`http://localhost:8082${req.url}`)
      client.req = req
      client.clientId = uid.sync(global.WEBSOCKET_IDENTIFIER_ROUNDS)
      client.subscriptions = []

      let bearer = url.searchParams.get('bearer')
      if (bearer) {
        let {user, scope} = await Authentication.bearerAuthenticate({bearer})
        if (user) {
          client.user = user
          client.scope = scope
        }
      }

      this.onConnection({client})

      client.on('message', (message) => {
        try {
          let request = JSON.parse(String(message))
          this.onMessage({client, request})
        } catch (ex) {
          logger.info('Failed to parse incoming websocket message')
        }
      })

      for (let event of apiEvents) {
        process.on(event, (ctx, result, permissions) => {
          this.onEvent.call(this, event, ctx, result, permissions)
        })
      }

      process.on('apiBroadcast', (id, ctx, result) => {
        this.onBroadcast.call(this, id, ctx, result)
      })
    })
  }

  async onConnection ({client}) {
    let ctx = new Context({client, request: {}})
    let route = await WebSocket.getRoute('version', 'read')
    let result = await route(ctx)
    let meta = {
      event: 'connection'
    }

    let rateLimit = this.traffic.validateRateLimit(ctx, false)
    Object.assign(meta, {
      'API-Version': 'v2.1',
      'Rate-Limit-Limit': rateLimit.total,
      'Rate-Limit-Remaining': rateLimit.remaining,
      'Rate-Limit-Reset':  this.traffic.nextResetDate
    })
    this.send({client, message: { result:  result.data, meta: meta }})
  }

  async onMessage ({client, request}) {
    try {
      let { result, meta } = await this.route({client, request})
      if (!result.meta) {
        result.meta = {}
      }
      Object.assign(result.meta, meta)
      this.send({client, message: result})
    } catch (ex) {
      let error = ex
      if ((error instanceof APIError) === false) {
        error = new InternalServerError({})
      }
      this.send({client, message: Object.assign({'meta': request.meta}, error)})
    }
  }

  async route ({client, request}) {
    let ctx = new Context({client, request})

    let rateLimit = this.traffic.validateRateLimit(ctx)

    let meta = Object.assign(request.meta || {}, {
      'API-Version': 'v2.1',
      'Rate-Limit-Limit': rateLimit.total,
      'Rate-Limit-Remaining': rateLimit.remaining,
      'Rate-Limit-Reset':  this.traffic.nextResetDate
    })

    let [endpointName, methodName] = request.action || []
    let route = WebSocket.getRoute({endpointName, methodName})
    let result = await route(ctx)

    return { result:  result, meta: meta }
  }

  onBroadcast ({id, ctx, result}) {
    let clients = [...this.socket.clients].filter((client) => {
      return client.subscriptions.includes(id)
    })
    this.broadcast({clients, message: result})
  }

  onEvent (event, ctx, result, permissions = null) {
    let clients = [...this.socket.clients].filter((client) => {
      if (client.clientId !== ctx.client.clientId) {
        return (!permissions || Permission.granted({permissions, ...client}))
      }
      return false
    })
    if (!result.meta) {
      result.meta = {}
    }

    Object.assign(result.meta, { event })
    this.broadcast({clients, message: result})
  }

  send ({client, message}) {
    try {
      if (process.env.NODE_ENV === 'production') {
        client.send(JSON.stringify(message))
      } else {
        client.send(JSON.stringify(message, null, PRETTY_PRINT_SPACING))
      }
    } catch (ex) {
      logger.info('Failed to send websocket message')
    }
  }

  broadcast ({clients, message}) {
    for (let client of clients) {
      this.send({client, message})
    }
  }

  static addRoute ({endpointName, methodName, method}) {
    if (routes.hasOwnProperty(endpointName) === false) {
      routes[endpointName] = {}
    }

    routes[endpointName][methodName] = method
  }

  static getRoute ({endpointName, methodName}) {
    if (routes.hasOwnProperty(endpointName) === false || routes[endpointName].hasOwnProperty(methodName) === false) {
      throw NotFoundAPIError({ parameter: 'action' })
    }
    return routes[endpointName][methodName]
  }
}

export class Context {
  constructor ({client, request}) {
    this.inet = client.req.headers['X-Forwarded-for'] || client.req.connection.remoteAddress

    this.client = client
    this.state = {}
    this.state.scope = client.scope
    this.state.user = client.user

    this.query = {}
    Object.assign(this.query, request)
    this.meta = new Meta()
    Object.assign(this.meta, this.query)
    this.data = request.data

    delete this.query.data
    delete this.query.meta
    delete this.query.action
    this.params = this.query
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
    WebSocket.addRoute({endpointName, methodName, method: descriptor.value})
  }
}
