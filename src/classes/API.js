
import Permission from './Permission'
import { ForbiddenAPIError, UnauthorizedAPIError, BadRequestAPIError } from './APIError'
import yayson from 'yayson'
import router from './Router'
import Meta from './Meta'
import { Rat } from '../db'
import { UUID } from './Validators'

const config = require('../../config')

/**
 * @class
 * Base class for FuelRats API endpoints
 */
export default class API {

  // eslint-disable-next-line no-unused-vars
  getReadPermissionFor ({ connection, entity }) {
    return []
  }

  // eslint-disable-next-line no-unused-vars
  getWritePermissionFor ({ connection, entity }) {
    return []
  }

  hasReadPermission ({ connection, entity }) {
    return Permission.granted({ permissions: this.getReadPermissionFor({ connection, entity }), ...connection.state })
  }

  hasWritePermission ({ connection, entity }) {
    return Permission.granted({ permissions: this.getWritePermissionFor({ connection, entity }), ...connection.state })
  }

  requireReadPermission ({ connection, entity }) {
    if (!this.hasReadPermission({ connection, entity })) {
      throw new ForbiddenAPIError({})
    }
  }

  requireWritePermission ({ connection, entity }) {
    if (!this.hasWritePermission({ connection, entity })) {
      throw new ForbiddenAPIError({})
    }
  }

  static get presenter () {
    return yayson({
      adapter: 'sequelize'
    }).Presenter
  }

  static meta (result, query = null, additionalParameters = {}) {
    return new Meta({ result, query, additionalParameters })
  }

  static async getAuthor (ctx) {
    if (ctx.req && ctx.req.headers.hasOwnProperty('x-command-by')) {
      const ratId = ctx.req.headers['x-command-by']
      if (UUID.test(ratId) === false) {
        return null
      }

      const rat = await Rat.findOne({
        where: {
          id: ratId
        }
      })

      return rat.user
    } else {
      return ctx.state.user
    }
  }
}

/**
 * ESNext Decorator for routing this method through a koa router GET endpoint
 * @param route the http path to route
 * @returns {Function} An ESNExt decorator function
 */
export function GET (route) {
  return function (target, name, descriptor) {
    router.get(route, descriptor.value)
  }
}

/**
 * ESNext Decorator for routing this method through a koa router post endpoint
 * @param route
 * @returns {Function}
 */
export function POST (route) {
  return function (target, name, descriptor) {
    router.post(route, descriptor.value)
  }
}

/**
 * ESNext Decorator for routing this method through a koa router PUT endpoint
 * @param route
 * @returns {Function}
 */
export function PUT (route) {
  return function (target, name, descriptor) {
    router.put(route, descriptor.value)
  }
}

/**
 * ESNext Decorator for routing this method through a koa router DELETE endpoint
 * @param route
 * @returns {Function}
 */
export function DELETE (route) {
  return function (target, name, descriptor) {
    router.del(route, descriptor.value)
  }
}

/**
 * ESNext Decorator for requiring authentication on an endpoint
 */
export function authenticated (target, name, descriptor) {
  const endpoint = descriptor.value

  descriptor.value = function (...args) {
    const [ctx] = args
    if (ctx.state.user) {
      return endpoint.apply(target, args)
    } else {
      throw new UnauthorizedAPIError({})
    }
  }
}

/**
 * ESNext Decorator for requiring client authentication on an endpoint
 */
export function clientAuthenticated (target, name, descriptor) {
  const endpoint = descriptor.value

  descriptor.value = function (...args) {
    const [ctx] = args
    if (ctx.state.client) {
      return endpoint.apply(this, args)
    } else {
      throw new UnauthorizedAPIError({})
    }
  }
}

/**
 * ESNext Decorator for requiring IP address authentication on an endpoint
 */
export function IPAuthenticated (target, name, descriptor) {
  const endpoint = descriptor.value

  descriptor.value = function (...args) {
    const [ctx] = args
    if (config.whitelist.includes(ctx.inet)) {
      return endpoint.apply(this, args)
    } else {
      throw new UnauthorizedAPIError({})
    }
  }
}

/**
 * ESNext Decorator requiring a set of permissions for an API endpoint
 * @param perms the permissions to require
 * @returns {Function} A decorator function
 */
export function permissions (...perms) {
  return function (target, name, descriptor) {
    const endpoint = descriptor.value

    descriptor.value = function (...args) {
      const [ctx] = args
      if (Permission.granted({permissions: perms, ...ctx.state})) {
        return endpoint.apply(this, args)
      } else {
        throw new ForbiddenAPIError({})
      }
    }
  }
}

/**
 * ESNext Decorator for requiring query parameters in an endpoint
 * @param fields The query parameters to require
 * @returns {Function} A decorator function
 */
export function parameters (...fields) {
  return function (target, name, descriptor) {
    const endpoint = descriptor.value

    descriptor.value = function (...args) {
      const [ctx] = args
      const missingFields = fields.filter((requiredField) => {
        return (requiredField in ctx.params === false && requiredField in ctx.query === false)
      })
      if (missingFields.length > 0) {
        throw missingFields.map((field) => {
          return new BadRequestAPIError({ parameter: field })
        })
      }
      return endpoint.apply(this, args)
    }
  }
}

/**
 * ESNext Decorator for requiring data fields in an endpoint
 * @param fields The data fields to require
 * @returns {Function} A decorator function
 *
 */
export function required (...fields) {
  return function (target, name, descriptor) {
    const endpoint = descriptor.value

    descriptor.value = function (...args) {
      const [ctx] = args
      const missingFields = fields.filter((requiredField) => {
        return ctx.data.hasOwnProperty(requiredField) === false
      })
      if (missingFields.length > 0) {
        throw missingFields.map((field) => {
          return new BadRequestAPIError({ pointer: `/data/attributes/${field}` })
        })
      }
      return endpoint.apply(this, args)
    }
  }
}

/**
 * ESNext Decorator for disallowing a set of data fields in an endpoint
 * @param fields The data fields to disallow
 * @returns {Function} A decorator function
 */
export function disallow (...fields) {
  return function (target, name, descriptor) {
    const endpoint = descriptor.value

    descriptor.value = function (...args) {
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
 * @param permission the permission to require
 * @param fields the fields to require this permission for
 * @returns {Function} A decorator function
 */
export function protect (permission, ...fields) {
  return function (target, name, descriptor) {
    const endpoint = descriptor.value

    descriptor.value = function (...args) {
      const [ctx] = args
      if (ctx.data) {
        fields.map((field) => {
          if (!ctx.data[field]) {
            return false
          }

          if (!Permission.granted({ permissions: [permission], ...ctx.state })) {
            throw new ForbiddenAPIError({})
          }
          return true
        })
      }
      return endpoint.apply(target, args)
    }
  }
}
