import { URL } from 'url'
import config from '../config'

/**
 * Request object for WebSocket connections
 * @class
 */
export class Request {
  /**
   * Create a request object
   * @param {object} arg function arguments object
   * @param {object} arg.client websocket client data
   * @param {object} arg.query request query
   * @param {object} arg.body request body
   * @param {object} arg.message the message
   */
  constructor ({ client, query = {}, body = {}, message = {} }) {
    const url = new URL(`${config.server.externalUrl}${client.url || '/'}`)

    this.header = client.headers || {}
    this.headers = this.header
    this.method = 'WEBSOCKET'
    this.length = message.length
    this.url = client.url || '/'
    this.originalUrl = this.url
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
    this.ip = client.ip || '127.0.0.1'
    this.ips = [this.ip]
    this.subdomains = url.hostname.split('.')
    this.is = () => {
      return false
    }
    this.socket = null
    this.get = (header) => {
      return (this.headers[header.toLowerCase()] ?? '') || ''
    }
    this.req = { method: 'WEBSOCKET', headers: this.headers }
  }
}

/**
 * Response object for WebSocket connections
 */
export class Response {
  /**
   * Create a response object
   */
  constructor () {
    this.header = {}
    this.headers = this.header
    this.socket = null
    this.status = 200
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

/**
 * @typedef {object} Context
 * @type {object} Request context for WebSocket connections
 */
export class Context {
  /**
   * Create a request context
   * @param {object} arg function arguments object
   * @param {object} arg.client websocket client data
   * @param {object} arg.query request query
   * @param {object} arg.body the request body
   * @param {object} arg.message the request message
   */
  constructor ({ client, query, body, message }) {
    const request = new Request({ client, query, body, message })
    const response = new Response()
    this.client = client
    this.isWebsocket = true

    this.req = request.req
    this.res = {}
    this.request = request
    this.response = response

    this.state = {}
    this.state.scope = client.scope
    this.state.user = client.user
    this.state.clientId = client.clientId
    this.state.permissions = client.permissions
    this.state.userAgent = (client.headers || {})['user-agent']

    this.app = {}
    this.cookies = {
      get: () => {
        return undefined
      },
      set: () => {
        return undefined
      },
    }
    this.session = {}

    this.header = request.header
    this.headers = request.headers
    this.method = request.method
    this.url = request.url
    this.originalUrl = request.originalUrl
    this.origin = request.origin
    this.href = request.href
    this.path = request.path
    this.query = request.query
    this.params = request.query
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
    this.set = (header, value) => { response.set(header, value) }
    this.data = request.body

    this.body = response.body
    this.status = response.status
    this.message = response.message
    this.length = response.length
    this.type = response.type
  }
}
