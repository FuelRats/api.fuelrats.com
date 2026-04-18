import parseQuery from '../helpers/parseQuery'

/**
 * Adapter that wraps a Hono context (c) into the Koa-like ctx interface
 * that all route handlers expect. Same pattern as Context.mjs for WebSocket.
 * @class
 */
export class RequestContext {
  /**
   * Create a RequestContext from a Hono context
   * @param {object} arg function arguments object
   * @param {import('hono').Context} arg.c Hono context
   * @param {object} [arg.state] Pre-populated state from middleware
   * @param {object} [arg.session] Session data from middleware
   */
  constructor ({ c, state = {}, session = {} }) {
    this._c = c
    this.isWebsocket = false

    // State and session
    this.state = { ...state }
    this.session = session
    this.client = {}
    this.endpoint = null

    // Parse query with dot-notation support
    const url = new URL(c.req.url)
    const rawQuery = Object.fromEntries(url.searchParams)
    this.query = parseQuery(rawQuery)

    // Route params
    this.params = c.req.param()

    // Request body (set externally after async parsing)
    this.data = {}

    // Headers from state
    this.state.userAgent = c.req.header('user-agent')
    this.state.fingerprint = c.req.header('x-fingerprint')

    // Request sub-object (for code that accesses ctx.request.*)
    const headers = {}
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value
    })

    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      || '127.0.0.1'

    this.request = {
      body: this.data,
      ip,
      ips: [ip],
      headers,
      header: headers,
      type: c.req.header('content-type'),
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      url: c.req.url,
      originalUrl: c.req.url,
      req: { method: c.req.method },
      get: (key) => c.req.header(key),
      is: () => false,
    }

    // Response state (tracked here, applied to Hono response by decorator)
    this._status = 200
    this._type = undefined
    this._body = undefined
    this._headers = {}

    // Response sub-object
    this.response = {
      get body () { return this._ctx._body },
      set body (v) { this._ctx._body = v },
      get status () { return this._ctx._status },
      set status (v) { this._ctx._status = v },
      get length () { return 0 },
    }
    this.response._ctx = this

    // Cookies stub (session middleware handles actual cookies)
    this.cookies = {
      get: () => undefined,
      set: () => undefined,
    }

    // App stub
    this.app = {}
  }

  /**
   * Get a request header value
   * @param {string} header header name
   * @returns {string|undefined} header value
   */
  get (header) {
    return this._c.req.header(header) ?? ''
  }

  /**
   * Set a response header
   * @param {string} header header name
   * @param {*} value header value
   */
  set (header, value) {
    this._headers[header] = String(value)
  }

  get ip () {
    return this.request.ip
  }

  get status () { return this._status }
  set status (v) { this._status = v }

  get type () { return this._type }
  set type (v) { this._type = v }

  get body () { return this._body }
  set body (v) { this._body = v }

  /**
   * Redirect to a URL
   * @param {string} url redirect target
   */
  redirect (url) {
    this._redirect = url
  }
}
