import config from '../../config'
import enumerable from '../classes/Enum'
import Query from '../query'

/**
 * @classdesc JSONAPI View base class
 * @class
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
   * @param {object} arg function arguments object
   * @param {object} arg.object object to render the view from
   * @param {Query} arg.query request query
   * @param {object} arg.root the root view of the document the view belongs to
   */
  constructor ({ object, query, root = undefined }) {
    this.object = object
    this.query = query
    this.root = root
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

  /**
   * The view's relationships
   * @returns {object}
   */
  get relationships () {
    return {}
  }

  /**
   * THe view's includes
   * @returns {[string]}
   */
  get includes () {
    return []
  }

  /**
   * Whether this view requires internal permissions
   * @returns {boolean}
   * @abstract
   */
  get isInternal () {
    return undefined
  }

  /**
   * Whether this view is associated with the user
   * @returns {boolean}
   * @abstract
   */
  get isSelf () {
    return undefined
  }

  /**
   * Whether this view is associated with the user's group
   * @returns {boolean}
   * @abstract
   */
  get isGroup () {
    return undefined
  }

  /**
   * The view's JSONAPI links
   * @returns {object}
   */
  get links () {
    return {
      self: `${config.server.externalUrl}/${this.self}`
    }
  }

  /**
   * The view's self link
   * @returns {string}
   */
  get self () {
    if (this.root) {
      return `${this.root.self}/${this.id}`
    }
    return `${this.type}/${this.id}`
  }

  /**
   * JSONAPI Links for a relation relative to this view
   * @param {string} relation the relation
   * @returns {object}
   */
  getRelationLink (relation) {
    return {
      self: `${config.server.externalUrl}/${this.self}/relationships/${relation}`,
      related: `${config.server.externalUrl}/${this.self}/${relation}`
    }
  }

  /**
   * Related views to this one
   * @returns {[View]}
   */
  get related () {
    return []
  }

  /**
   * The rendered view
   * @returns {object}
   */
  get view () {
    return {
      type: this.type,
      id: this.id,
      attributes: this.generateAttributes(),
      relationships: this.generateRelationships(),
      links: this.links
    }
  }

  /**
   * Rendered relationship view
   * @returns {object}
   */
  get relationshipView () {
    return {
      type: this.type,
      id: this.id
    }
  }

  /**
   * Generate the attributes to display in this view
   * @returns {object}
   */
  generateAttributes () {
    return Object.entries(this.attributes).reduce((acc, value) => {
      let [attribute, permission] = value
      if (typeof permission === 'undefined') {
        permission = this.defaultReadPermission
      }

      if (this.hasPermissionForField(permission, attribute)) {
        acc[attribute] = this.attributeForKey(attribute)
      }
      return acc
    }, {})
  }

  /**
   * Check whether the user has permission to see a specific field of this view
   * @param {ReadPermission} permission field read permission
   * @returns {boolean}
   */
  hasPermissionForField (permission) {
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

  /**
   * The default read permission for attributes in this view
   * @returns {ReadPermission}
   * @abstract
   */
  get defaultReadPermission () {
    return undefined
  }

  /**
   * Get an attribute from a key
   * @returns {any}
   * @abstract
   */
  attributeForKey () {
    return undefined
  }

  /**
   * Generate relationships
   * @returns {object}
   * @abstract
   */
  generateRelationships () {
    return {}
  }

  /**
   * Generate includes
   * @returns {object}
   * @abstract
   */
  generateIncludes () {
    return {}
  }

  /**
   * Render the view
   * @returns {object}
   */
  render () {
    return this.view
  }

  /**
   * Get a string representation of the view
   * @returns {object}
   */
  toString () {
    return this.render()
  }
}

@enumerable
/**
 * Field Read permission
 */
export class ReadPermission {
  static internal
  static self
  static group
  static all
}
