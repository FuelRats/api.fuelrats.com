'use strict'
const Error = require('./errors')

// Import controllers
const rat = require('./controllers/rat')
const Permission = require('./permission')
const rescue = require('./controllers/rescue')
const stream = require('./controllers/stream')
const client = require('./controllers/client')
const user = require('./controllers/user')

const controllers = {
  rats: {
    create: [rat.create],
    read: [rat.search],
    update: [rat.update, true],
    delete: [rat.delete, true, 'rat.delete']
  },

  rescues: {
    create: [rescue.create, true],
    read: [rescue.search],
    update: [rescue.update, true],
    delete: [rescue.delete, true]
  },

  users: {
    create: [user.create, true],
    read: [user.search, true, 'user.read'],
    update: [user.update, true],
    delete: [user.delete, true, 'user.delete']
  },

  client: {
    create: [client.create, true, 'self.client.create'],
    read: [client.search, true, 'client.read'],
    update: [client.update, true, 'client.update'],
    delete: [client.delete, true, 'client.delete']
  },

  stream: {
    subscribe: [stream.subscribe],
    unsubscribe: [stream.unsubscribe],
    broadcast: [stream.broadcast]
  }
}

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
  'clientCreated',
  'clientUpdated',
  'clientDeleted',
  'shipCreated',
  'shipUpdated',
  'shipDeleted'
]

class WebSocketManager {
  constructor (socket, trafficManager) {
    this.socket = socket
    this.traffic = trafficManager

    let _this = this
    for (let event of apiEvents) {
      process.on(event, function (ctx, result, permissions) {
        _this.onEvent.call(_this, event, ctx, result, permissions)
      })
    }

    process.on('apiBroadcast', function (id, ctx, result) {
      _this.onBroadcast.call(_this, id, ctx, result)
    })
  }

  onBroadcast (id, ctx, result) {
    let clients = this.socket.clients.filter((client) => {
      return client.subscriptions.includes(id)
    })
    this.broadcast(clients, result)
  }

  onEvent (event, ctx, result, permissions = null) {
    let clients = this.socket.clients.filter((client) => {
      if (client.clientId !== ctx.client.clientId) {
        return (!permissions || Permission.granted(permissions, client.user, client.scope))
      }
      return false
    })
    result.meta.event = event
    this.broadcast(clients, result)
  }

  async onMessage (client, request) {
    try {
      let { result, meta } = await this.process(client, request)
      result.meta = Object.assign(result.meta || {}, meta)
      this.send(client, result)
    } catch (ex) {
      let error = ex
      if (!error.code) {
        error = Error.template('server_error', error)
      }
      this.send(client, ex)
    }
  }

  async process (client, request) {
    client.websocket = this
    if (!request.action || request.action.length < 2 || !Array.isArray(request.action)) {
      throw Error.template('missing_required_field', 'action')
    }

    let controller = request.action[0]
    let method = request.action[1]

    if (!controllers[controller] || !controllers[controller][method]) {
      throw Error.template('invalid_parameter', 'action')
    }

    let [endpoint, authenticationRequired, requiredPermissions] = controllers[controller]

    if (!authenticationRequired || client.user) {
      if (!requiredPermissions || Permission.require(requiredPermissions, client.user, client.scope)) {
        let ctx = new Context(client, request)

        let rateLimit = this.traffic.validateRateLimit(ctx)

        let meta = Object.assign(request.meta || {}, {
          'API-Version': 'v2.0',
          'Rate-Limit-Limit': rateLimit.total,
          'Rate-Limit-Remaining': rateLimit.remaining,
          'Rate-Limit-Reset':  this.traffic.nextResetDate
        })

        let result = await endpoint(ctx)

        return { result:  result, meta: meta }
      }
    } else if (authenticationRequired) {
      throw Error.template('not_authenticated')
    }
  }

  send (client, message) {
    client.send(JSON.stringify(message))
  }

  broadcast (clients, message) {
    for (let client of clients) {
      this.send(client, message)
    }
  }

  static meta (result, query = null, additionalParameters = {}) {
    let meta = {
      meta: {}
    }
    if (query) {
      if (Array.isArray(result)) {
        meta.meta = {
          count: result.length,
          limit: query._limit || null,
          offset: query._offset || null,
        }
      } else {
        meta.meta = {
          count: result.rows.length,
          limit: query._limit || null,
          offset: query._offset || null,
          total: result.count
        }
      }
    }

    meta.meta = Object.assign(meta.meta, additionalParameters)
    return meta
  }
}

class Context {
  constructor (client, request) {
    this.meta = WebSocketManager.meta

    this.inet = client.upgradeReq.headers['X-Forwarded-for'] || client.upgradeReq.connection.remoteAddress

    this.client = client
    this.state = {}
    this.state.scope = client.scope
    this.state.user = client.user

    this.query = request
    this.data = request.data

    delete this.query.data
    delete this.query.meta
    delete this.query.action
    this.params = this.query
  }
}

module.exports = WebSocketManager