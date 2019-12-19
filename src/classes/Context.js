import { URL } from 'url'
import config from '../config'
import ws from 'ws'

/**
 * Request object
 * @class
 */
export class Request {
  /**
   * Create a request object
   * @param {object} arg function arguments object
   * @param {ws.Client} arg.client websocket client
   * @param {object} arg.query request query
   * @param {object} arg.body request body
   * @param {object} arg.message the message
   */
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

/**
 * Response object
 */
export class Response {
  /**
   * Create a response object
   * @param {ws.Client} client websocket client
   */
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

/**
 * @typedef {object} Context
 * @type {object} Request context
 */
export class Context {
  /**
   * Create a request context
   * @param {object} arg function arguments object
   * @param {ws.Client} arg.client websocket client
   * @param {object} arg.query request query
   * @param {object} arg.body the request body
   * @param {object} arg.message the request message
   */
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
      set: () => {
        return undefined
      }
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
