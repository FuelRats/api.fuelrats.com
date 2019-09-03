import config from '../../config'
import enumerable from '../classes/Enum'

/**
 * @classdesc JSONAPI View base class
 * @class
 *
 */
export default class View {
  object = undefined
  query = undefined
  parent = undefined
  #cachedInternal = undefined
  #cachedSelf = undefined
  #cachedGroup = undefined

  /**
   * Create a JSONAPI View
   * @param object
   * @param query
   * @param parentUrl
   * @constructor
   */
  constructor ({ object, query, parentUrl = undefined }) {
    this.object = object
    this.query = query
    this.parentUrl = parentUrl
  }

  /**
   * Defines the JSONAPI resource type this view represents. e.g "users"
   * @returns {string} JSONAPI resource type
   * @abstract
   */
  static get type () {
    return undefined
  }

  /**
   * Access the JSONAPI resource type of the current view instance
   * @returns {string} JSONAPI resource type
   */
  get type () {
    return Object.getPrototypeOf(this).constructor.type
  }

  /**
   * Returns the ID of the JSONAPI resource this view represents
   * @returns {string} JSONAPI resource ID
   */
  get id () {
    return undefined
  }

  /**
   * Returns the attributes of this JSONAPI resource
   * @returns {*} attributes of the JSONAPI resource
   */
  get attributes () {
    return undefined
  }

  get relationships () {
    return {}
  }

  get includes () {
    return []
  }

  get isInternal () {
    return undefined
  }

  get isSelf () {
    return undefined
  }

  get isGroup () {
    return undefined
  }

  get links () {
    return {
      self: `${config.externalUrl}/${this.self}`
    }
  }

  get self () {
    if (this.parentUrl) {
      return `${this.parentUrl}/${this.id}`
    }
    return `${this.type}/${this.id}`
  }

  getRelationLink (relation) {
    return {
      self: `${config.externalUrl}/${this.self}/relationships/${relation}`,
      related: `${config.externalUrl}/${this.self}/${relation}`
    }
  }

  get related () {
    return []
  }

  get view () {
    return {
      type: this.type,
      id: this.id,
      attributes: this.generateAttributes(),
      relationships: this.generateRelationships(),
      links: this.links
    }
  }

  get relationshipView () {
    return {
      type: this.type,
      id: this.id
    }
  }

  generateAttributes () {
    return Object.entries(this.attributes).reduce((acc, value) => {
      var [attribute, permission] = value
      if (typeof permission === 'undefined') {
        permission = this.defaultReadPermission
      }

      if (this.hasPermissionForField(permission, attribute)) {
        acc[attribute] = this.attributeForKey(attribute)
      }
      return acc
    }, {})
  }

  hasPermissionForField (permission, field) {
    switch (permission) {
      case ReadPermission.all:
        return true

      case ReadPermission.internal:
        if (!this.#cachedInternal) {
          this.#cachedInternal = this.isInternal
        }
        return this.#cachedInternal

      case ReadPermission.group:
        if (!this.#cachedGroup) {
          this.#cachedGroup = this.isSelf || this.isGroup
        }
        return this.#cachedGroup

      case ReadPermission.self:
        if (!this.#cachedSelf) {
          this.#cachedSelf = this.isSelf
        }
        return this.#cachedSelf

      default:
        return false
    }
  }

  get defaultReadPermission () {
    return undefined
  }

  attributeForKey () {
    return undefined
  }

  generateRelationships () {
    return {}
  }

  generateIncludes () {
    return {}
  }

  render () {
    return this.view
  }

  toString () {
    return this.render()
  }
}

@enumerable
export class ReadPermission {
  static internal
  static self
  static group
  static all
}
