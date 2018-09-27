export default class View {
  object = null

  constructor ({ object }) {
    this.object = object
  }

  get type () {
    return null
  }

  get id () {
    return null
  }

  get attributes () {
    return null
  }

  get relationships () {
    return {}
  }

  get includes () {
    return {}
  }

  get links () {
    const links = [this.self, ...this.related]

    return links.map((link) => {
      return link.self
    })
  }

  get self () {
    return null
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
