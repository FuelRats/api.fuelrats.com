import { Hono } from 'hono'
import {
  BadRequestAPIError,
  ForbiddenAPIError,
  NotFoundAPIError,
  UnauthorizedAPIError,
  UnprocessableEntityAPIError,
} from '../classes/APIError'
import Authentication from '../classes/Authentication'
import { Context } from '../classes/Context'
import { InvalidClientOAuthError } from '../classes/OAuthError'
import Permission from '../classes/Permission'
import { RequestContext } from '../classes/RequestContext'
import StatusCode from '../classes/StatusCode'
import config from '../config'
import Document from '../Documents/Document'
import enumerable from '../helpers/Enum'

/**
 * Shared Hono app instance for all API routes (replaces koa-router)
 */
export const app = new Hono()

/**
 * Create a Hono route handler that adapts between Hono context and the
 * Koa-like ctx interface that all route handlers expect.
 * @param {Function} method the decorated (and possibly wrapped) route method
 * @param {object} instance the route class instance
 * @returns {Function} Hono-compatible async route handler
 */
function createRouteHandler (method, instance) {
  return async (c) => {
    const ctx = new RequestContext({
      c,
      state: c.get('state') || {},
      session: c.get('session') || {},
    })

    // Parse request body
    const contentType = c.req.header('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      try {
        const formData = await c.req.formData()
        ctx.request.files = {}
        ctx.data = {}
        for (const [key, value] of formData.entries()) {
          if (value instanceof File) {
            const buffer = await value.arrayBuffer()
            ctx.request.files[key] = {
              path: null,
              name: value.name,
              type: value.type,
              size: value.size,
              buffer: Buffer.from(buffer),
            }
          } else {
            ctx.data[key] = value
          }
        }
        ctx.request.body = ctx.data
      } catch {
        ctx.data = {}
        ctx.request.body = {}
      }
    } else if (contentType.includes('json') || c.req.method !== 'GET') {
      try {
        ctx.data = await c.req.json()
        ctx.request.body = ctx.data
      } catch {
        ctx.data = {}
        ctx.request.body = {}
      }
    }

    // Clean timestamp fields from request data
    if (ctx.data && typeof ctx.data === 'object') {
      for (const field of ['createdAt', 'updatedAt', 'deletedAt', 'revision']) {
        delete ctx.data[field]
      }
    }

    ctx.endpoint = instance
    const result = await method.call(instance, ctx)

    // Build response headers
    const headers = new Headers()
    for (const [key, value] of Object.entries(ctx._headers)) {
      headers.set(key, String(value))
    }

    // Write session back if middleware is tracking it
    if (c.get('writeSession')) {
      c.get('writeSession')(ctx.session)
    }

    // Handle redirects
    if (ctx._redirect) {
      return c.redirect(ctx._redirect, ctx._status || 302)
    }

    // Handle response based on return type
    if (result === true) {
      return new Response(null, { status: StatusCode.noContent, headers })
    }

    if (result instanceof Document) {
      headers.set('Content-Type', 'application/vnd.api+json')
      return new Response(result.toString(), { status: ctx._status, headers })
    }

    if (result) {
      if (ctx._type) {
        headers.set('Content-Type', ctx._type)
      }
      if (typeof result === 'string' || result instanceof Buffer || result instanceof Uint8Array) {
        return new Response(result, { status: ctx._status, headers })
      }
      headers.set('Content-Type', 'application/json')
      return new Response(JSON.stringify(result), { status: ctx._status, headers })
    }

    if (typeof result === 'undefined' && !ctx._body) {
      throw new NotFoundAPIError({})
    }

    if (ctx._type) {
      headers.set('Content-Type', ctx._type)
    }
    return new Response(ctx._body, { status: ctx._status, headers })
  }
}

/**
 * @class
 * @classdesc Base class for FuelRats API endpoints
 */
export default class API {
  resource = undefined
  view = undefined

  /**
   * The JSONAPI type for the resource this API endpoint is for, override.
   * @returns {string} JSONAPI type
   * @abstract
   */
  get type () {
    return undefined
  }
}

// region Decorators

/**
 * TC39 Decorator for routing this method through a Hono GET endpoint
 * @param {string} route the http path to route
 * @returns {Function} A TC39 decorator function
 */
export function GET (route) {
  return (method, context) => {
    context.addInitializer(function () {
      app.get(route, createRouteHandler(method, this))
    })
    return method
  }
}

/**
 * TC39 Decorator for routing this method through a Hono POST endpoint
 * @param {string} route the http path to route
 * @returns {Function}
 */
export function POST (route) {
  return (method, context) => {
    context.addInitializer(function () {
      app.post(route, createRouteHandler(method, this))
    })
    return method
  }
}

/**
 * TC39 Decorator for routing this method through a Hono PUT endpoint
 * @param {string} route the http path to route
 * @returns {Function}
 */
export function PUT (route) {
  return (method, context) => {
    context.addInitializer(function () {
      const handler = createRouteHandler(method, this)
      app.put(route, handler)
      app.patch(route, handler)
    })
    return method
  }
}

/**
 * TC39 Decorator for routing this method through a Hono PATCH endpoint
 * @param {string} route the http path to route
 * @returns {Function}
 */
export function PATCH (route) {
  return (method, context) => {
    context.addInitializer(function () {
      app.patch(route, createRouteHandler(method, this))
    })
    return method
  }
}

/**
 * TC39 Decorator for routing this method through a Hono DELETE endpoint
 * @param {string} route the http path to route
 * @returns {Function}
 */
export function DELETE (route) {
  return (method, context) => {
    context.addInitializer(function () {
      app.delete(route, createRouteHandler(method, this))
    })
    return method
  }
}

/**
 * TC39 Decorator for requiring authentication on an endpoint
 */
export function authenticated (method, context) {
  return function (...args) {
    const [ctx] = args
    if (ctx.state.user) {
      return method.call(this, ...args)
    }
    throw new UnauthorizedAPIError({})
  }
}

/**
 * TC39 Decorator for requiring client authentication on an endpoint
 */
export function clientAuthenticated (method, context) {
  return async function (...args) {
    const [ctx] = args
    const client = await Authentication.requireClientAuthentication({ connection: ctx })
    if (!client) {
      throw new InvalidClientOAuthError()
    }
    ctx.state.client = client
    return method.call(this, ...args)
  }
}

/**
 * TC39 Decorator for requiring basic user authentication on an endpoint
 */
export function basicAuthenticated (method, context) {
  return function (...args) {
    const [ctx] = args
    if (ctx.state.basicAuth === true) {
      return method.call(this, ...args)
    }
    throw new UnauthorizedAPIError({})
  }
}

/**
 * TC39 Decorator for requiring IP address authentication on an endpoint
 */
export function IPAuthenticated (method, context) {
  return function (...args) {
    const [ctx] = args
    if (config.server.whitelist.includes(ctx.request.ip)) {
      return method.call(this, ...args)
    }
    throw new UnauthorizedAPIError({})
  }
}

/**
 * TC39 Decorator requiring a set of permissions for an API endpoint
 * @param {...string} perms the permissions to require
 * @returns {Function} A decorator function
 */
export function permissions (...perms) {
  return (method, context) => {
    return function (...args) {
      const [ctx] = args
      if (Permission.granted({ permissions: perms, connection: ctx })) {
        return method.call(this, ...args)
      }
      throw new ForbiddenAPIError({})
    }
  }
}

/**
 * TC39 Decorator for requiring query parameters in an endpoint
 * @param {...string} fields The query parameters to require
 * @returns {Function} A decorator function
 */
export function parameters (...fields) {
  return (method, context) => {
    return function (...args) {
      const [ctx] = args
      const missingFields = fields.filter((requiredField) => {
        return (Reflect.has(ctx.params, requiredField) === false && Reflect.has(ctx.query, requiredField) === false)
      })
      if (missingFields.length > 0) {
        throw missingFields.map((field) => {
          return new BadRequestAPIError({ parameter: field })
        })
      }
      return method.call(this, ...args)
    }
  }
}

/**
 * TC39 Decorator for requiring data fields in an endpoint
 * @param {...string} fields The data fields to require
 * @returns {Function} A decorator function
 */
export function required (...fields) {
  return (method, context) => {
    return function (...args) {
      const [ctx] = args
      const missingFields = fields.filter((requiredField) => {
        if (!ctx.data.data?.attributes) {
          return true
        }
        return Reflect.has(ctx.data.data.attributes, requiredField) === false
      })
      if (missingFields.length > 0) {
        throw missingFields.map((field) => {
          return new BadRequestAPIError({ pointer: `/data/attributes/${field}` })
        })
      }
      return method.call(this, ...args)
    }
  }
}

/**
 * TC39 Decorator for disallowing a set of data fields in an endpoint
 * @param {...string} fields The data fields to disallow
 * @returns {Function} A decorator function
 */
export function disallow (...fields) {
  return (method, context) => {
    return function (...args) {
      const [ctx] = args
      if (Array.isArray(ctx.data) || typeof ctx.data === 'object') {
        fields.map((cleanField) => {
          delete ctx.data[cleanField]
          return cleanField
        })
      }
      return method.call(this, ...args)
    }
  }
}

/**
 * Protect a set of fields in an endpoint with a specific permission
 * @param {string} permission the permission to require
 * @param {...string} fields the fields to require this permission for
 * @returns {Function} A decorator function
 */
export function protect (permission, ...fields) {
  return (method, context) => {
    return function (...args) {
      const [ctx] = args
      if (ctx.data) {
        fields.map((field) => {
          if (!ctx.data[field]) {
            return false
          }

          if (!Permission.granted({ permissions: [permission], connection: ctx })) {
            throw new ForbiddenAPIError({})
          }
          return true
        })
      }
      return method.call(this, ...args)
    }
  }
}

// endregion

/**
 * Validate whether an object is a valid JSONAPI Object
 * @param {object} arg function arguments object
 * @param {object} arg.object object to validate
 * @returns {boolean} True if valid, false is not valid
 */
export function isValidJSONAPIObject ({ object }) {
  if (object instanceof Object && (object.type && object.type.constructor === String)) {
    if (object.attributes instanceof Object || object.relationships instanceof Object) {
      return true
    }
  }
  return false
}

/**
 * Retrieve the data field of a JSONAPI request
 * @param {object} arg function arguments object
 * @param {Context} arg.ctx request context
 * @param {string} arg.type the JSONAPI resource type
 * @param {boolean} [arg.requireAttributes] Whether to require attributes to be present in the object
 * @returns {object} JSONAPI data field
 */
export function getJSONAPIData ({ ctx, type, requireAttributes = true }) {
  if (!ctx.data.data || !isValidJSONAPIObject({ object: ctx.data.data }) || ctx.data.data.type !== type) {
    throw new UnprocessableEntityAPIError({ pointer: '/data' })
  }

  if (!(ctx.data.data.attributes instanceof Object) && requireAttributes) {
    throw new UnprocessableEntityAPIError({ pointer: '/data/attributes' })
  }

  return ctx.data.data
}

/**
 * Enum for types of write permissions that can be required for a field
 */
@enumerable()
export class WritePermission {
  static internal
  static self
  static group
  static sudo
  static all
}
