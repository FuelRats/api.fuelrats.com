import Permission from './Permission'
import {
  ForbiddenAPIError,
  UnauthorizedAPIError,
  BadRequestAPIError,
  NotFoundAPIError,
  UnprocessableEntityAPIError
} from './APIError'
import yayson from 'yayson'
import router from './Router'
import Meta from './Meta'
import { Rat } from '../db'
import { UUID } from './Validators'

const config = require('../../config')

/* no-unused-vars in function arguments is being ignored for this class since
it is a base class for API endpoints to override */
/* eslint no-unused-vars: ["error", { "args": "none" }] */

/**
 * @class
 * Base class for FuelRats API endpoints
 */
export default class API {
  view = undefined

  /**
   * The JSONAPI type for the resource this API endpoint is for, override.
   * @returns {string} JSONAPI type
   * @abstract
   */
  get type () {
    return undefined
  }

  /**
   * Base function to create a database entry from a request
   * @param ctx a request context
   * @param databaseType a database type object
   * @returns {Promise<Model>} A transaction to retrieve the created object
   */
  async create ({ ctx, databaseType }) {
    if (!isValidJSONAPIObject({ object: ctx.data.data }) || ctx.data.data.type !== this.type) {
      throw new UnprocessableEntityAPIError({ pointer: '/data' })
    }

    if (!(ctx.data.data.attributes instanceof Object)) {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes' })
    }

    const entity = await databaseType.create(ctx.data.data.attributes)

    if (ctx.data.relationships instanceof Object) {
      const relationshipChanges = Object.entries(ctx.data.relationships).map(([relationship, data]) => {
        return this.generateRelationshipChange({ data, entity, change: 'add', relationship })
      })

      await Promise.all(relationshipChanges)
    }

    return databaseType.findOne({
      where: {
        id: entity.id
      }
    })
  }

  /**
   * Base function to update a database entry from a request
   * @param ctx A request context
   * @param databaseType a database type object
   * @param updateSearch search parameter on which to issue an update
   * @returns {Promise<Model>}  A transaction to retrieve the updated object
   */
  async update ({ ctx, databaseType, updateSearch }) {
    if (!ctx.params.id) {
      throw new BadRequestAPIError({ parameter: 'id' })
    }

    if (!isValidJSONAPIObject({ object: ctx.data.data }) || ctx.data.data.type !== this.type) {
      throw new UnprocessableEntityAPIError({ pointer: '/data' })
    }

    const entity = await databaseType.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!entity) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission({ connection: ctx, entity })

    if (ctx.data.data.attributes instanceof Object) {
      await entity.update(ctx.data.data.attributes, updateSearch)
    }

    if (ctx.data.relationships instanceof Object) {
      const relationshipChanges = Object.entries(ctx.data.relationships).map(([relationship, data]) => {
        return this.generateRelationshipChange({ data, entity, change: 'patch', relationship })
      })

      await Promise.all(relationshipChanges)
    }

    return databaseType.findOne({
      where: {
        id: ctx.params.id
      }
    })
  }

  /**
   * Base function to delete a datbase entry from a request
   * @param ctx a request context
   * @param databaseType a database type object
   * @returns {Promise<undefined>} A delete transaction
   */
  async delete ({ ctx, databaseType }) {
    if (!ctx.params.id) {
      throw new BadRequestAPIError({ parameter: 'id' })
    }

    const entity = await databaseType.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!entity) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission({ connection: ctx, entity })

    return entity.destroy()
  }

  async relationshipView ({ ctx, databaseType, relationship }) {
    if (!ctx.params.id) {
      throw new BadRequestAPIError({ parameter: 'id' })
    }

    const entity = await databaseType.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!entity) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireReadPermission({ connection: ctx, entity })

    return databaseType.findOne({
      where: {
        id: ctx.params.id
      }
    })
  }

  /**
   * Perform a relationship change based on a PATCH /relationships request
   * @param ctx the context of a PATCH /relationships request
   * @param databaseType the sequelize object for this data type
   * @param change The type of relationship change to perform (add, patch, remove)
   * @param relationship the relationship to change
   * @returns {Promise<Model>} A resource with its relationships updated
   */
  async relationshipChange ({ ctx, databaseType, change, relationship }) {
    if (!ctx.params.id) {
      throw new BadRequestAPIError({ parameter: 'id' })
    }

    const entity = await databaseType.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!entity) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission({ connection: ctx, entity })

    await this.generateRelationshipChange({ data: ctx.data.data, entity, change, relationship })

    return databaseType.findOne({
      where: {
        id: ctx.params.id
      }
    })
  }

  /**
   * Generate a relationship change database call from a JSONAPI compliant relationship object
   * @param data a JSONAPI compliant relationship object
   * @param entity the entity to change the relationship of
   * @param change the type of change to perform (add, patch, remove)
   * @param relationship The relationship to change
   * @returns {*} a database change promise for updating the relationships
   */
  generateRelationshipChange ({ data, entity, change, relationship }) {
    const changeRelationship = this.changeRelationship({ relationship })
    const validOneRelationship = this.isValidOneRelationship({ relationship: data })

    if (Array.isArray(data) && changeRelationship.many === true) {
      const relationshipIds = data.map((relationshipObject) => {
        const validManyRelationship = this.isValidManyRelationship({ relationship: relationshipObject })
        if (validManyRelationship === false) {
          throw new UnprocessableEntityAPIError({ pointer: '/data' })
        }
        return relationship.id
      })

      return changeRelationship[change]({ entity, ids: relationshipIds })
    } else if (validOneRelationship && changeRelationship.many === false) {
      return changeRelationship[change]({ entity, id: data.id })
    } else {
      throw new UnprocessableEntityAPIError({ pointer: '/data' })
    }
  }

  getReadPermissionFor ({ connection, entity }) {
    return []
  }

  getWritePermissionFor ({ connection, entity }) {
    return []
  }

  hasReadPermission ({ connection, entity }) {
    return Permission.granted({ permissions: this.getReadPermissionFor({ connection, entity }), ...connection.state })
  }

  hasWritePermission ({ connection, entity }) {
    return Permission.granted({ permissions: this.getWritePermissionFor({ connection, entity }), ...connection.state })
  }

  changeRelationship ({ relationship }) {
    return undefined
  }

  get relationTypes () {
    return {}
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

  static meta (result, query = undefined, additionalParameters = {}) {
    return new Meta({ result, query, additionalParameters })
  }

  static async getAuthor (ctx) {
    if (ctx.req && ctx.req.headers.hasOwnProperty('x-command-by')) {
      const ratId = ctx.req.headers['x-command-by']
      if (UUID.test(ratId) === false) {
        return undefined
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

  isValidOneRelationship ({ relationship }) {
    if (relationship instanceof Object) {
      if (typeof relationship.id !== 'undefined' && relationship.type === this.relationTypes[relationship]) {
        return true
      }
    } else if (!relationship) {
      return true
    }
    return false
  }

  isValidManyRelationship ({ relationship }) {
    if (relationship instanceof Object) {
      if (typeof relationship.id !== 'undefined' && relationship.type === this.relationTypes[relationship]) {
        return true
      }
    }
    return false
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
 * ESNext Decorator for routing this method through a koa router PATCH endpoint
 * @param route
 * @returns {Function}
 * @constructor
 */
export function PATCH (route) {
  return function (target, name, descriptor) {
    router.patch(route, descriptor.value)
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

/**
 * Validate whether an object is a valid JSONAPI Object
 * @param object an object
 * @returns {boolean} True if valid, false is not valid
 */
export function isValidJSONAPIObject ({ object }) {
  if (object instanceof Object && object.id && (object.type && object.type.constructor === String)) {
    if (object.attributes instanceof Object || object.relationships instanceof Object) {
      return true
    }
  }
  return false
}
