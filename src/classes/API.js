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
import enumerable from './Enum'

const config = require('../../config')

/* no-unused-vars in function arguments is being ignored for this class since
it is a base class for API endpoints to override */
/* eslint no-unused-vars: ["error", { "args": "none" }] */

/**
 * @class
 * @classdesc Base class for FuelRats API endpoints
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
   * @param callback optional callback to perform actions before resource is returned
   * @returns {Promise<Model>} A transaction to retrieve the created object
   */
  async create ({ ctx, databaseType, callback = undefined }) {
    if (!isValidJSONAPIObject({ object: ctx.data.data }) || ctx.data.data.type !== this.type) {
      throw new UnprocessableEntityAPIError({ pointer: '/data' })
    }

    if (!(ctx.data.data.attributes instanceof Object)) {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes' })
    }

    const entity = await databaseType.create(ctx.data.data.attributes)

    if (callback) {
      await callback({ entity })
    }

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

    let { attributes } = ctx.data.data

    if (attributes instanceof Object) {
      this.validateUpdateAccess({ ctx, attributes })

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

  /**
   * Base function for relationship view requests
   * @param ctx a request context
   * @param databaseType a database type object
   * @param relationship the JSONAPI resource relattionship
   * @returns {Promise<Model>} a find transaction
   */
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
    const validOneRelationship = this.isValidOneRelationship({ relationship: data, relation: relationship })

    if (Array.isArray(data) && changeRelationship.many === true) {
      const relationshipIds = data.map((relationshipObject) => {
        const validManyRelationship = this.isValidManyRelationship({
          relationship: relationshipObject,
          relation: relationship
        })
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

  getAccessibleAttributes ({ scopes, attributes }) {
    return Object.entries(attributes).reduce((object, [attribute, value]) => {

      return object
    }, {})

  }

  /**
   * Validate whether the user has access to modify all the attributes in the update request
   * @param ctx a request context
   * @param attributes attributes list
   */
  validateUpdateAccess ({ ctx, attributes, entity }) {
    const isGroup = this.isGroup({ ctx, entity })
    const isSelf = this.isSelf({ ctx, entity })
    const isInternal = this.isInternal({ ctx, entity })

    Object.entries(attributes).forEach(([key]) => {
      const attributePermissions = this.writePermissionsForFieldAccess[key]
      if (!attributePermissions) {
        throw new ForbiddenAPIError({ pointer: `/data/attributes/${key}` })
      }

      const hasPermission = () => {
        switch (attributePermissions) {
          case WritePermission.all:
            return true

          case WritePermission.internal:
            return isInternal

          case WritePermission.sudo:
            return isGroup

          case WritePermission.group:
            return isGroup || isSelf

          case WritePermission.self:
            return isSelf

          default:
            return false
        }
      }

      if (hasPermission() === false) {
        throw new ForbiddenAPIError({ pointer: `/data/attributes/${key}` })
      }
    })
  }

  /**
   * Get a map of write permissions for fields
   * @returns {Object}
   * @abstract
   */
  get writePermissionsForFieldAccess () {
    return {}
  }

  /**
   * @abstract
   */
  isInternal ({ ctx, entity }) {
    return undefined
  }

  /**
   *
   * @param ctx
   * @param entity
   * @returns {undefined}
   * @abstract
   */
  isGroup ({ ctx, entity }) {
    return undefined
  }

  /**
   *
   * @param ctx
   * @param entity
   * @returns {undefined}
   * @abstract
   */
  isSelf ({ ctx, entity }) {
    return undefined
  }

  /**
   * Get read permissions for this ressource
   * @param connection a request context
   * @param entity a resource entity
   * @returns {Array} list of acceptable permissions
   * @abstract
   */
  getReadPermissionFor ({ connection, entity }) {
    return []
  }

  /**
   * Get write permissions for this ressource
   * @param connection a request context
   * @param entity a resource entity
   * @returns {Array} a list of acceptable permissions
   * @abstract
   */
  getWritePermissionFor ({ connection, entity }) {
    return []
  }

  /**
   * Get inividual field properties for this resource
   * @returns {Object} Field properties
   * @abstract
   */
  get fieldProperties () {
    return {}
  }

  /**
   * Check whether the user has read permission for this ressource
   * @param connection a request context
   * @param entity a resource entity
   * @returns {boolean} whether the user has read permission for this resource
   */
  hasReadPermission ({ connection, entity }) {
    return Permission.granted({ permissions: this.getReadPermissionFor({ connection, entity }), ...connection.state })
  }

  /**
   * Check whether the user has write permission for this ressource
   * @param connection a request context
   * @param entity a resource entity
   * @returns {boolean} whether the usre has write permission for this resource
   */
  hasWritePermission ({ connection, entity }) {
    return Permission.granted({ permissions: this.getWritePermissionFor({ connection, entity }), ...connection.state })
  }

  /**
   * Get a change relationship object for this resource defining the actions to perform for add, delete, and patch
   * relationship requests
   * @param relationship the relationship relative to the ressource
   * @returns {*} a change relationship object
   * @abstract
   */
  changeRelationship ({ relationship }) {
    return undefined
  }

  /**
   * Get a map of JSONAPI ressource types for the relationships of this resource
   * @returns {*} a map of JSONAPI ressource types
   * @abstract
   */
  get relationTypes () {
    return {}
  }

  /**
   * Require read permission to modify this entity
   * @param connection a request context
   * @param entity a resource entity
   */
  requireReadPermission ({ connection, entity }) {
    if (!this.hasReadPermission({ connection, entity })) {
      throw new ForbiddenAPIError({})
    }
  }

  /**
   * Require write permission to modify this entity
   * @param connection a request context
   * @param entity a resource entity
   */
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

  /**
   * Check whether a relationship is a valid one-to-one relationship for this resource
   * @param relationship a relationship object
   * @param relation name of the relation relative to the resource
   * @returns {boolean} Whether the relationship is a valid one-to-one relationship for this resource
   */
  isValidOneRelationship ({ relationship, relation }) {
    if (relationship instanceof Object) {
      if (typeof relationship.id !== 'undefined' && relationship.type === this.relationTypes[relation]) {
        return true
      }
    } else if (!relationship) {
      return true
    }
    return false
  }

  /**
   * Check whether a relationship is a valid many relationship for this resource
   * @param relationship a relationship object
   * @param relation name of the relation relative to the resource
   * @returns {boolean} Whether the relationship is a valid many relationship for this resource
   */
  isValidManyRelationship ({ relationship, relation }) {
    if (relationship instanceof Object) {
      if (typeof relationship.id !== 'undefined' && relationship.type === this.relationTypes[relation]) {
        return true
      }
    }
    return false
  }
}


// region Decorators
/**
 * ESNext Decorator for routing this method through a koa router GET endpoint
 * @param route the http path to route
 * @returns {Function} An ESNExt decorator function
 */
export function GET (route) {
  return function (target, name, descriptor) {
    const endpoint = descriptor.value

    descriptor.value = function (...args) {
      const [ctx] = args
      ctx.endpoint = this
      return endpoint.apply(this, args)
    }
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
    const endpoint = descriptor.value

    descriptor.value = function (...args) {
      const [ctx] = args
      ctx.endpoint = this
      return endpoint.apply(this, args)
    }
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
    const endpoint = descriptor.value

    descriptor.value = function (...args) {
      const [ctx] = args
      ctx.endpoint = this
      return endpoint.apply(this, args)
    }
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
    const endpoint = descriptor.value

    descriptor.value = function (...args) {
      const [ctx] = args
      ctx.endpoint = this
      return endpoint.apply(this, args)
    }
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
    const endpoint = descriptor.value

    descriptor.value = function (...args) {
      const [ctx] = args
      ctx.endpoint = this
      return endpoint.apply(this, args)
    }
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
// endregion

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

@enumerable
export class WritePermission {
  static internal
  static self
  static group
  static sudo
  static all
}
