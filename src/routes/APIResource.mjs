/* no-unused-vars in function arguments is being ignored for this class since
it is a base class for API endpoints to override */
/* eslint no-unused-vars: ["error", { "args": "none" }] */

import {
  BadRequestAPIError,
  ForbiddenAPIError,
  NotFoundAPIError,
  UnprocessableEntityAPIError,
} from '../classes/APIError'
import { Context } from '../classes/Context'
import Permission from '../classes/Permission'
import { Rat, db } from '../db'
import { UUID } from '../helpers/Validators'
import DatabaseQuery from '../query/DatabaseQuery'
import API, { getJSONAPIData, WritePermission } from './API'

/**
 * @class
 * @classdesc Base class for FuelRats API endpoints
 */
export default class APIResource extends API {
  /**
   * The JSONAPI type for the resource this API endpoint is for, override.
   * @returns {string} JSONAPI type
   * @abstract
   */
  get type () {
    return undefined
  }

  /**
   * Base function to find a database entry by id
   * @param {object} arg function parameters
   * @param {Context} arg.ctx request context
   * @param {db.Model} arg.databaseType a database type object
   * @param {boolean} arg.requirePermission whether a read permission challenge should be made
   * @returns {Promise<{result: db.Model<any, any>, query: DatabaseQuery}>} query object and result object
   */
  async findById ({ ctx, databaseType, requirePermission = false }) {
    const query = new DatabaseQuery({ connection: ctx })

    const result = await databaseType.findOne({
      where: {
        id: ctx.params.id,
      },
    })

    if (!result) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    if (requirePermission) {
      this.requireWritePermission({ connection: ctx, entity: result })
    }

    return { query, result }
  }

  /**
   * Base function to create a database entry from a request
   * @param {object} arg function arguments object
   * @param {Context} arg.ctx a request context
   * @param {db.Model} arg.databaseType a database type object
   * @param {Function} arg.callback optional callback to perform actions before resource is returned
   * @param {object} arg.overrideFields fields to override in the create statement
   * @param {boolean} arg.allowId Whether request client is allowed to define an ID for the created resource
   * @returns {Promise<db.Model>} A transaction to retrieve the created object
   */
  async create ({
    ctx, databaseType, callback = undefined, overrideFields = {}, allowId = false,
  }) {
    const dataObj = getJSONAPIData({ ctx, type: this.type })

    delete dataObj.attributes.createdAt
    delete dataObj.attributes.updatedAt

    let resourceId = {}
    if (dataObj.id) {
      if (allowId) {
        resourceId = { id: dataObj.id }
      } else {
        throw new ForbiddenAPIError({
          pointer: '/data/id',
        })
      }
    }

    await this.validateCreateAccess({ ctx, attributes: dataObj.attributes })

    const transaction = await db.transaction()

    let entity = undefined
    try {
      entity = await databaseType.create({
        ...dataObj.attributes,
        ...overrideFields,
        ...resourceId,
      }, { transaction })

      if (callback) {
        await callback({ entity, transaction })
      }

      if (dataObj.relationships instanceof Object) {
        const relationshipChanges = Object.entries(dataObj.relationships).map(([relationship, data]) => {
          return this.generateRelationshipChange({
            ctx, data: data.data, entity, change: 'add', relationship, transaction,
          })
        })

        await Promise.all(relationshipChanges)
      }
    } catch (ex) {
      await transaction.rollback()
      throw ex
    }

    await transaction.commit()

    return databaseType.findOne({
      where: {
        id: entity.id,
      },
    })
  }

  /**
   * Base function to update a database entry from a request
   * @param {object} arg function arguments object
   * @param {Context} arg.ctx A request context
   * @param {db.Model} arg.databaseType a database type object
   * @param {object} arg.updateSearch search parameter on which to issue an update
   * @param {object} [arg.overrideFields] Optional fields to update in the query
   * @returns {Promise<db.Model>}  A transaction to retrieve the updated object
   */
  async update ({ ctx, databaseType, updateSearch, overrideFields = {} }) {
    if (!ctx.params.id) {
      throw new BadRequestAPIError({ parameter: 'id' })
    }

    const dataObj = getJSONAPIData({ ctx, type: this.type })

    const entity = await databaseType.findOne({
      where: {
        id: ctx.params.id,
      },
    })

    if (!entity) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission({ connection: ctx, entity })

    const { attributes } = dataObj
    delete attributes.createdAt
    delete attributes.updatedAt

    const transaction = await db.transaction()

    try {
      if (attributes instanceof Object) {
        this.validateUpdateAccess({ ctx, attributes, entity })

        await entity.update({
          ...attributes,
          ...overrideFields,
        }, { ...updateSearch, transaction })
      }

      if (ctx.data.relationships instanceof Object) {
        const relationshipChanges = Object.entries(ctx.data.relationships).map(([relationship, data]) => {
          return this.generateRelationshipChange({
            ctx, data, entity, change: 'patch', relationship, transaction,
          })
        })

        await Promise.all(relationshipChanges)
      }
    } catch (ex) {
      await transaction.rollback()
      throw ex
    }

    await transaction.commit()

    return databaseType.findOne({
      where: {
        id: ctx.params.id,
      },
    })
  }

  /**
   * Base function to delete a database entry from a request
   * @param {object} arg function arguments object
   * @param {object} arg.ctx a request context
   * @param {db.Model} arg.databaseType a database type object
   * @returns {Promise<undefined>} A delete transaction
   */
  async delete ({ ctx, databaseType, hasPermission = undefined, callback }) {
    if (!ctx.params.id) {
      throw new BadRequestAPIError({ parameter: 'id' })
    }

    const entity = await databaseType.findOne({
      where: {
        id: ctx.params.id,
      },
    })

    if (!entity) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    if (hasPermission) {
      const permissionResult = await hasPermission(entity).bind(this)
      if (permissionResult === false) {
        throw new ForbiddenAPIError({})
      }
    } else {
      this.requireWritePermission({ connection: ctx, entity })
    }


    if (callback) {
      await callback(entity)
    }

    return entity.destroy({ force: ctx.state.forceDelete })
  }

  /**
   * Base function for relationship view requests
   * @param {object} arg function arguments object
   * @param {object} arg.ctx a request context
   * @param {db.Model} arg.databaseType a database type object
   * @param {object} arg.relationship the JSONAPI resource relationship
   * @returns {Promise<db.Model>} a find transaction
   */
  async relationshipView ({ ctx, databaseType, relationship }) {
    if (!ctx.params.id) {
      throw new BadRequestAPIError({ parameter: 'id' })
    }

    const entity = await databaseType.findOne({
      where: {
        id: ctx.params.id,
      },
    })

    if (!entity) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireReadPermission({ connection: ctx, entity })

    return entity[relationship]
  }

  /**
   * Perform a relationship change based on a PATCH /relationships request
   * @param {object} arg function arguments object
   * @param {object} arg.ctx the context of a PATCH /relationships request
   * @param {db.Model} arg.databaseType the sequelize object for this data type
   * @param {string} arg.change The type of relationship change to perform (add, patch, remove)
   * @param {string} arg.relationship the relationship to change
   * @returns {Promise<db.Model>} A resource with its relationships updated
   */
  async relationshipChange ({
    ctx,
    databaseType,
    change,
    relationship,
    callback = undefined,
  }) {
    if (!ctx.params.id) {
      throw new BadRequestAPIError({ parameter: 'id' })
    }

    const entity = await databaseType.findOne({
      where: {
        id: ctx.params.id,
      },
    })

    if (!entity) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission({ connection: ctx, entity })

    if (callback) {
      await callback(entity)
    }

    const transaction = await db.transaction()

    try {
      await this.generateRelationshipChange({
        ctx, data: ctx.data.data, entity, change, relationship, transaction,
      })
    } catch (ex) {
      await transaction.rollback()
      throw ex
    }

    await transaction.commit()

    return databaseType.findOne({
      where: {
        id: ctx.params.id,
      },
    })
  }

  /**
   * Generate a relationship change database call from a JSONAPI compliant relationship object
   * @param {object} arg function arguments object
   * @param {object} arg.data a JSONAPI compliant relationship object
   * @param {object} arg.entity the entity to change the relationship of
   * @param {string} arg.change the type of change to perform (add, patch, remove)
   * @param {string} arg.relationship The relationship to change
   * @param {db.Transaction} arg.transaction optional transaction to use for database operations
   * @returns {Promise<undefined>} a database change promise for updating the relationships
   */
  generateRelationshipChange ({
    ctx, data, entity, change, relationship, transaction,
  }) {
    const changeRelationship = this.changeRelationship({ relationship })
    const validOneRelationship = this.isValidOneRelationship({ relationship: data, relation: relationship })

    if (Array.isArray(data) && changeRelationship.many === true) {
      if (data.length === 0) {
        return undefined
      }
      const relationshipIds = data.map((relationshipObject) => {
        const validManyRelationship = this.isValidManyRelationship({
          relationship: relationshipObject,
          relation: relationship,
        })
        if (validManyRelationship === false) {
          throw new UnprocessableEntityAPIError({ pointer: '/data' })
        }


        if (!Reflect.apply(changeRelationship.hasPermission, this, [ctx, entity, relationship.id])) {
          throw new ForbiddenAPIError({ pointer: '/data' })
        }
        return relationshipObject.id
      })

      return changeRelationship[change]({ entity, ids: relationshipIds, ctx, transaction })
    }
    if (validOneRelationship && changeRelationship.many === false) {
      if (!data) {
        return undefined
      }

      if (!Reflect.apply(changeRelationship.hasPermission, this, [ctx, entity, relationship.id])) {
        throw new ForbiddenAPIError({ pointer: '/data' })
      }
      return changeRelationship[change]({ entity, id: data.id, ctx, transaction })
    }
    throw new UnprocessableEntityAPIError({ pointer: '/data' })
  }

  /**
   * Require that relationships exist in the request object
   * @param {object} arg function arguments object
   * @param {Context} arg.ctx request context
   * @param {[string]} arg.relationships relationship names to require
   */
  requireRelationships ({ ctx, relationships }) {
    const dataObj = getJSONAPIData({ ctx, type: this.type })

    if ((dataObj.relationships instanceof Object) === false) {
      throw new UnprocessableEntityAPIError({ pointer: '/data/relationships' })
    }

    const missingRelations = relationships.filter((relationship) => {
      return Object.keys(dataObj.relationships).includes(relationship) === false
    })

    if (missingRelations.length > 0) {
      throw missingRelations.map((relation) => {
        return new UnprocessableEntityAPIError({ pointer: `/data/relationships/${relation}` })
      })
    }
  }

  /**
   * Validate whether the user has access to create all the attributes in the create request
   * @param {object} arg function arguments object
   * @param {Context} arg.ctx request context
   * @param {object} arg.attributes attributes list
   */
  validateCreateAccess ({ ctx, attributes }) {
    const isGroup = Permission.granted({
      permissions: [`${this.type}.write`],
      connection: ctx,
    })
    const isSelf = Permission.granted({
      permissions: [`${this.type}.write.me`],
      connection: ctx,
    })
    const isInternal = Permission.granted({
      permissions: [`${this.type}.internal`],
      connection: ctx,
    })

    this.validatePermissionForFields({ attributes, isInternal, isGroup, isSelf })
  }

  /**
   * Validate permissions on a set of fields using a set of permissions
   * @param {object} arg function arguments object
   * @param {{object}} arg.attributes key-value object representing the fields we validate
   * @param {boolean} arg.isInternal Whether we have internal access permission
   * @param {boolean} arg.isGroup Whether we have group level access permission
   * @param {boolean} arg.isSelf Whether we have self level access permission
   */
  validatePermissionForFields ({ attributes, isInternal, isGroup, isSelf }) {
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
            return isGroup ?? isSelf

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
   * Validate whether the user has access to modify all the attributes in the update request
   * @param {object} arg function arguments object
   * @param {Context} arg.ctx a request context
   * @param {object} arg.attributes attributes list
   * @param {object} arg.entity the entity to validate
   */
  validateUpdateAccess ({ ctx, attributes, entity }) {
    const isGroup = Permission.granted({
      permissions: [`${this.type}.write`],
      connection: ctx,
    })
    const isSelf = this.isSelf({ ctx, entity }) && Permission.granted({
      permissions: [`${this.type}.write.me`],
      connection: ctx,
    })
    const isInternal = Permission.granted({
      permissions: [`${this.type}.internal`],
      connection: ctx,
    })

    this.validatePermissionForFields({ attributes, isInternal, isGroup, isSelf })
  }

  /**
   * Get a map of write permissions for fields
   * @returns {object}
   * @abstract
   */
  get writePermissionsForFieldAccess () {
    return {}
  }

  /**
   * Check whether this entity requires self-level access (Can only be accessed by themselves, or admin)
   * @param {object} arg function arguments object
   * @param {object} arg.ctx request context
   * @param {object} arg.entity the entity to check access level on
   * @returns {boolean} whether this entity requires self-level access
   * @abstract
   */
  isSelf ({ ctx, entity }) {
    return undefined
  }

  /**
   * Check whether the user has read permission for this resource
   * @param {object} arg function arguments object
   * @param {object} arg.connection a request context
   * @param {object} arg.entity a resource entity
   * @returns {boolean} whether the user has read permission for this resource
   */
  hasReadPermission ({ connection, entity }) {
    if (this.isSelf({ ctx: connection, entity })) {
      return Permission.granted({ permissions: [`${this.type}.read.me`, `${this.type}.read`], connection })
    }
    return Permission.granted({ permissions: [`${this.type}.read`], connection })
  }

  /**
   * Check whether the user has write permission for this resource
   * @param {object} arg function arguments object
   * @param {object}  arg.connection a request context
   * @param {object} arg.entity a resource entity
   * @returns {boolean} whether the user has write permission for this resource
   */
  hasWritePermission ({ connection, entity }) {
    if (this.isSelf({ ctx: connection, entity })) {
      return Permission.granted({ permissions: [`${this.type}.write.me`, `${this.type}.write`], connection })
    }
    return Permission.granted({ permissions: [`${this.type}.write`], connection })
  }

  /**
   * Get a change relationship object for this resource defining the actions to perform for add, delete, and patch
   * relationship requests
   * @param {string} relationship the relationship relative to the resource
   * @returns {*} a change relationship object
   * @abstract
   */
  changeRelationship ({ relationship }) {
    return undefined
  }

  /**
   * Get a map of JSONAPI resource types for the relationships of this resource
   * @returns {*} a map of JSONAPI resource types
   * @abstract
   */
  get relationTypes () {
    return {}
  }

  /**
   * Require read permission to modify this entity
   * @param {object} arg function arguments object
   * @param {object} arg.connection a request context
   * @param {object} arg.entity a resource entity
   */
  requireReadPermission ({ connection, entity }) {
    if (!this.hasReadPermission({ connection, entity })) {
      throw new ForbiddenAPIError({})
    }
  }

  /**
   * Require write permission to modify this entity
   * @param {object} arg function arguments object
   * @param {object} arg.connection a request context
   * @param {object} arg.entity a resource entity
   */
  requireWritePermission ({ connection, entity }) {
    if (!this.hasWritePermission({ connection, entity })) {
      throw new ForbiddenAPIError({})
    }
  }

  /**
   * Get the author of a request
   * @param {object} ctx request context
   * @returns {Promise<db.User>}
   */
  static async getAuthor (ctx) {
    if (ctx.req && Reflect.has(ctx.req.headers, 'x-command-by')) {
      const ratId = ctx.req.headers['x-command-by']
      if (UUID.test(ratId) === false) {
        return undefined
      }

      const rat = await Rat.findOne({
        where: {
          id: ratId,
        },
      })

      return rat.user
    }
    return ctx.state.user
  }

  /**
   * Check whether a relationship is a valid one-to-one relationship for this resource
   * @param {object} arg function arguments object
   * @param {object} arg.relationship a relationship object
   * @param {string} arg.relation name of the relation relative to the resource
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
   * @param {object} arg function arguments object
   * @param {object} arg.relationship a relationship object
   * @param {string} arg.relation name of the relation relative to the resource
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
