import config from '../../config'

export default class View {
  object = undefined
  query = undefined
  parent = undefined

  constructor ({ object, query, parentUrl = undefined }) {
    this.object = object
    this.query = query
    this.parentUrl = parentUrl
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
      attributes: this.attributes,
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

  generateRelationships () {
    return {}
  }

  generateIncludes () {
    return {}
  }

  toString () {
    return this.view
  }
}
