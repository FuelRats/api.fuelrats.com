import {
  BadRequestAPIError,
  ForbiddenAPIError,
  UnauthorizedAPIError,
  UnprocessableEntityAPIError,
} from '../classes/APIError'
import Authentication from '../classes/Authentication'
import { Context } from '../classes/Context'
import { InvalidClientOAuthError } from '../classes/OAuthError'
import Permission from '../classes/Permission'
import router from '../classes/Router'
import config from '../config'
import enumerable from '../helpers/Enum'

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
 * ESNext Decorator for routing this method through a koa router GET endpoint
 * @param {string} route the http path to route
 * @returns {Function} An ESNExt decorator function
 */
export function GET (route) {
  return (target, name, descriptor) => {
    const endpoint = descriptor.value

    descriptor.value = function value (...args) {
      const [ctx] = args
      ctx.endpoint = this
      return endpoint.apply(target, args)
    }
    router.get(route, descriptor.value)
  }
}

/**
 * ESNext Decorator for routing this method through a koa router post endpoint
 * @param {string} route the http path to route
 * @returns {Function}
 */
export function POST (route) {
  return (target, name, descriptor) => {
    const endpoint = descriptor.value

    descriptor.value = function value (...args) {
      const [ctx] = args
      ctx.endpoint = this
      return endpoint.apply(target, args)
    }
    router.post(route, descriptor.value)
  }
}

/**
 * ESNext Decorator for routing this method through a koa router PUT endpoint
 * @param {string} route the http path to route
 * @returns {Function}
 */
export function PUT (route) {
  return (target, name, descriptor) => {
    const endpoint = descriptor.value

    descriptor.value = function value (...args) {
      const [ctx] = args
      ctx.endpoint = this
      return endpoint.apply(target, args)
    }
    router.put(route, descriptor.value)
    router.patch(route, descriptor.value)
  }
}

/**
 * ESNext Decorator for routing this method through a koa router PATCH endpoint
 * @param {string} route the http path to route
 * @returns {Function}
 */
export function PATCH (route) {
  return (target, name, descriptor) => {
    const endpoint = descriptor.value

    descriptor.value = function value (...args) {
      const [ctx] = args
      ctx.endpoint = this
      return endpoint.apply(target, args)
    }
    router.patch(route, descriptor.value)
  }
}

/**
 * ESNext Decorator for routing this method through a koa router DELETE endpoint
 * @param {Function} route the http path to route
 * @returns {Function}
 */
export function DELETE (route) {
  return (target, name, descriptor) => {
    const endpoint = descriptor.value

    descriptor.value = function value (...args) {
      const [ctx] = args
      ctx.endpoint = this
      return endpoint.apply(this, args)
    }
    router.del(route, descriptor.value)
  }
}

// eslint-disable-next-line jsdoc/require-param
/**
 * ESNext Decorator for requiring authentication on an endpoint
 */
export function authenticated (target, name, descriptor) {
  const endpoint = descriptor.value

  descriptor.value = function value (...args) {
    const [ctx] = args
    if (ctx.state.user) {
      return endpoint.apply(target, args)
    }
    throw new UnauthorizedAPIError({})
  }
}

// eslint-disable-next-line jsdoc/require-param
/**
 * ESNext Decorator for requiring client authentication on an endpoint
 */
export function clientAuthenticated (target, name, descriptor) {
  const endpoint = descriptor.value

  descriptor.value = async function value (...args) {
    const [ctx] = args
    const client = await Authentication.requireClientAuthentication({ connection: ctx })
    if (!client) {
      throw new InvalidClientOAuthError()
    }
    ctx.state.client = client
    return endpoint.apply(target, args)
  }
}

// eslint-disable-next-line jsdoc/require-param
/**
 * ESNext decorator for requiring basic user authentication on an endpoint
 */
export function basicAuthenticated (target, name, descriptor) {
  const endpoint = descriptor.value

  descriptor.value = function value (...args) {
    const [ctx] = args
    if (ctx.state.basicAuth === true) {
      return endpoint.apply(target, args)
    }
    throw new UnauthorizedAPIError({})
  }
}

// eslint-disable-next-line jsdoc/require-param
/**
 * ESNext Decorator for requiring IP address authentication on an endpoint
 */
export function IPAuthenticated (target, name, descriptor) {
  const endpoint = descriptor.value

  descriptor.value = function value (...args) {
    const [ctx] = args
    if (config.server.whitelist.includes(ctx.request.ip)) {
      return endpoint.apply(target, args)
    }
    throw new UnauthorizedAPIError({})
  }
}

/**
 * ESNext Decorator requiring a set of permissions for an API endpoint
 * @param {...string} perms the permissions to require
 * @returns {Function} A decorator function
 */
export function permissions (...perms) {
  return (target, name, descriptor) => {
    const endpoint = descriptor.value

    descriptor.value = function value (...args) {
      const [ctx] = args
      if (Permission.granted({ permissions: perms, connection: ctx })) {
        return endpoint.apply(target, args)
      }
      throw new ForbiddenAPIError({})
    }
  }
}

/**
 * ESNext Decorator for requiring query parameters in an endpoint
 * @param {...string} fields The query parameters to require
 * @returns {Function} A decorator function
 */
export function parameters (...fields) {
  return (target, name, descriptor) => {
    const endpoint = descriptor.value

    descriptor.value = function value (...args) {
      const [ctx] = args
      const missingFields = fields.filter((requiredField) => {
        return (Reflect.has(ctx.params, requiredField) === false && Reflect.has(ctx.query, requiredField) === false)
      })
      if (missingFields.length > 0) {
        throw missingFields.map((field) => {
          return new BadRequestAPIError({ parameter: field })
        })
      }
      return endpoint.apply(target, args)
    }
  }
}

/**
 * ESNext Decorator for requiring data fields in an endpoint
 * @param {...string} fields The data fields to require
 * @returns {Function} A decorator function
 *
 */
export function required (...fields) {
  return (target, name, descriptor) => {
    const endpoint = descriptor.value

    descriptor.value = function value (...args) {
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
      return endpoint.apply(target, args)
    }
  }
}

/**
 * ESNext Decorator for disallowing a set of data fields in an endpoint
 * @param {...string} fields The data fields to disallow
 * @returns {Function} A decorator function
 */
export function disallow (...fields) {
  return (target, name, descriptor) => {
    const endpoint = descriptor.value

    descriptor.value = function value (...args) {
      const [ctx] = args
      if (Array.isArray(ctx.data) || typeof ctx.data === 'object') {
        fields.map((cleanField) => {
          delete ctx.data[cleanField]
          return cleanField
        })
      }
      return endpoint.apply(target, args)
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
  return (target, name, descriptor) => {
    const endpoint = descriptor.value

    descriptor.value = function value (...args) {
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
      return endpoint.apply(target, args)
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

