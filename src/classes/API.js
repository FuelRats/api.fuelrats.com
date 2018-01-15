
import Permission from './Permission'
import {ForbiddenAPIError, UnauthorizedAPIError, BadRequestAPIError} from './APIError'
import yayson from 'yayson'
import router from './Router'
import Meta from './Meta'
let config = require('../../config')

/**
 * @class
 * Base class for FuelRats API endpoints
 */
export default class API {

  getReadPermissionForEntity () {
    return []
  }

  getWritePermissionForEntity () {
    return []
  }

  hasReadPermission (ctx, entity) {
    return Permission.granted(this.getReadPermissionForEntity(ctx, entity), ctx.state.user, ctx.state.scope)
  }

  hasWritePermission (ctx, entity) {
    return Permission.granted(this.getWritePermissionForEntity(ctx, entity), ctx.state.user, ctx.state.scope)
  }

  requireReadPermission (ctx, entity) {
    if (!this.hasReadPermission(ctx, entity)) {
      throw new ForbiddenAPIError({})
    }
  }

  requireWritePermission (ctx, entity) {
    if (!this.hasWritePermission(ctx, entity)) {
      throw new ForbiddenAPIError({})
    }
  }

  static get presenter () {
    return yayson({
      adapter: 'sequelize'
    }).Presenter
  }

  static meta (result, query = null, additionalParameters = {}) {
    return new Meta(result, query, additionalParameters)
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
  let endpoint = descriptor.value

  descriptor.value = function (ctx) {
    if (ctx.state.user) {
      return endpoint.apply(target, arguments)
    } else {
      throw new UnauthorizedAPIError({})
    }
  }
}

/**
 * ESNext Decorator for requiring client authentication on an endpoint
 */
export function clientAuthenticated (target, name, descriptor) {
  let endpoint = descriptor.value

  descriptor.value = function (ctx) {
    if (ctx.state.client) {
      return endpoint.apply(this, arguments)
    } else {
      throw new UnauthorizedAPIError({})
    }
  }
}

/**
 * ESNext Decorator for requiring IP address authentication on an endpoint
 */
export function IPAuthenticated (target, name, descriptor) {
  let endpoint = descriptor.value

  descriptor.value = function (ctx) {
    if (config.whitelist.includes(ctx.inet)) {
      return endpoint.apply(this, arguments)
    } else {
      throw new UnauthorizedAPIError({})
    }
  }
}

/**
 * ESNext Decorator requiring a set of permissions for an API endpoint
 * @param permissions the permissions to require
 * @returns {Function} A decorator function
 */
export function permissions (...permissions) {
  return function (target, name, descriptor) {
    let endpoint = descriptor.value

    descriptor.value = function (ctx) {
      if (Permission.granted(permissions, ctx.state.user, ctx.state.scope)) {
        return endpoint.apply(this, arguments)
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
    let endpoint = descriptor.value

    descriptor.value = function (ctx) {
      let missingFields = fields.filter((requiredField) => {
        return ctx.params.hasOwnProperty(requiredField) === false
      })
      if (missingFields.length > 0) {
        throw missingFields.map((field) => {
          return new BadRequestAPIError({ parameter: field })
        })
      }
      return endpoint.apply(this, arguments)
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
    let endpoint = descriptor.value

    descriptor.value = function (ctx) {
      let missingFields = fields.filter((requiredField) => {
        return ctx.data.hasOwnProperty(requiredField) === false
      })
      if (missingFields.length > 0) {
        throw missingFields.map((field) => {
          return new BadRequestAPIError({ pointer: `/data/attributes/${field}` })
        })
      }
      return endpoint.apply(this, arguments)
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
    let endpoint = descriptor.value

    descriptor.value = function (ctx) {
      if (Array.isArray(ctx.data) || typeof ctx.data === 'object') {
        fields.map((cleanField) => {
          delete ctx.data[cleanField]
        })
      }
      return endpoint.apply(target, arguments)
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
    let endpoint = descriptor.value

    descriptor.value = function (ctx) {
      if (ctx.data) {
        fields.map(field => {
          if (!ctx.data[field]) {
            return
          }

          if (!Permission.Permission.granted(permissions, ctx.state.user, ctx.state.scope)) {
            throw new ForbiddenAPIError({})
          }
        })
      }
      return endpoint.apply(target, arguments)
    }
  }
}
