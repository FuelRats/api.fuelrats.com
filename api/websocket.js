'use strict'
const Error = require('./errors')

// Import controllers
const rat = require('./controllers/rat')
const Permission = require('./permission')
const rescue = require('./controllers/rescue')
const stream = require('./controllers/stream')
const client = require('./controllers/client')
const user = require('./controllers/user')

let controllers = {
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
    unsubscribe: [stream.unsubscribe]
  }
}

class WebSocketManager {
  constructor (socket, trafficManager) {
    this.socket = socket
    this.traffic = trafficManager
  }

  async onMessage (client, request) {
    try {
      let { result, meta } = await this.process(client, request)
      result.meta = Object.assign(result.meta, meta)
      this.send(client, result)
    } catch (ex) {
      this.send(client, ex)
    }
  }

  async process (client, request) {
    client.websocket = this
    if (!request.action || request.action.length < 2) {
      throw Error.template('missing_required_field', 'action')
    }

    let controller = request.action[0]
    let method = request.action[1]

    if (!controllers[controller] || !controllers[controller][method]) {
      throw Error.template('invalid_parameter', 'action')
    }

    let authenticatedRequired = controllers[controller][method][1] === true
    let requiredPermissions = controllers[controller][method][2]
    let endpoint = controllers[controller][method][0]

    if (!authenticatedRequired || client.user) {
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
    } else if (authenticatedRequired) {
      throw Error.template('not_authenticated')
    }
  }

  send (client, message) {
    client.send(JSON.stringify(message))
  }

  static meta (result, query = null, additionalParameters = {}) {
    let meta = {
      meta: {}
    }
    if (query) {
      meta.meta = {
        count: result.rows.length,
        limit: query._limit || null,
        offset: query._offset || null,
        total: result.count
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

    delete this.query.meta
    delete this.query.action
    this.params = this.query
  }
}

module.exports = WebSocketManager