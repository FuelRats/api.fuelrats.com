import config from '../../config'
import enumerable from '../classes/Enum'

export default class View {
  object = undefined
  query = undefined
  parent = undefined
  #cachedInternal = undefined
  #cachedSelf = undefined
  #cachedGroup = undefined

  constructor ({ object, query, parentUrl = undefined }) {
    this.setObject(object)
    this.query = query
    this.parentUrl = parentUrl
  }

  setObject (object) {
    this.object = object
  }

  static get type () {
    return undefined
  }

  get type () {
    return Object.getPrototypeOf(this).constructor.type
  }

  get id () {
    return undefined
  }

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
