import View from '.'

export default class DatabaseView extends View {
  get id () {
    return this.object.id
  }

  attributeForKey (key) {
    return this.object[key]
  }

  generateRelationships () {
    return Object.entries(this.relationships).reduce((acc, [key, RelationshipView]) => {
      if (this.root && RelationshipView.type === this.root.type) {
        return acc
      }

      let data = undefined
      if (Array.isArray(this.object[key])) {
        data = this.object[key].map((relation) => {
          return (new RelationshipView({
            object: relation,
            root: this.root || this,
            query: this.query
          })).relationshipView
        })
      } else if (this.object[key]) {
        data = (new RelationshipView({
          object: this.object[key],
          root: this.root || this,
          query: this.query
        })).relationshipView
      }

      const linkObject = {
        links: this.getRelationLink(key)
      }

      if (data && (!Array.isArray(data) || data.length > 0)) {
        linkObject.data = data
      }

      acc[key] = linkObject
      return acc
    }, {})
  }

  generateIncludes ({ rootType, includeTypes }) {
    const includes = includeTypes || this.includes

    return Object.entries(this.relationships).reduce((acc, [key, RelationshipView]) => {
      let objects = this.object[key]
      if (!objects || !includes.includes(key) || rootType === RelationshipView.type) {
        return acc
      }

      if (!Array.isArray(objects)) {
        objects = [objects]
      }

      return acc.concat(objects.reduce((includeCollection, object) => {
        const objectView = (new RelationshipView({ object, root: this.root || this, query: this.query }))
        includeCollection.push(objectView.view)
        return includeCollection.concat(objectView.generateIncludes({ rootType, includeTypes }))
      }, []))
    }, [])
  }
}
