import View from './'

export default class SequelizeView extends View {
  get id () {
    return this.object.id
  }

  generateRelationships () {
    return Object.entries(this.relationships).reduce((acc, [key, RelationShipView]) => {
      let data = null
      if (Array.isArray(this.object[key])) {
        data = this.object[key].map((relation) => {
          return (new RelationShipView({ object: relation, parentUrl: this.self })).relationshipView
        })
      } else if (this.object[key]) {
        data = (new RelationShipView({ object: this.object[key], parentUrl: this.self })).relationshipView
      }

      const linkObject =  {
        links: this.getRelationLink(key)
      }

      if (data && (!Array.isArray(data) || data.length > 0)) {
        linkObject.data = data
      }

      acc[key] = linkObject
      return acc
    }, {})
  }

  generateIncludes ({ includeTypes }) {
    const includes = includeTypes || this.includes

    return Object.entries(this.relationships).reduce((acc, [key, RelationShipView]) => {
      let objects = this.object[key]
      if (!objects || !includes.includes(key)) {
        return acc
      }

      if (!Array.isArray(objects)) {
        objects = [objects]
      }

      return acc.concat(objects.reduce((includeCollection, object) => {
        const objectView = (new RelationShipView({ object }))
        includeCollection.push(objectView.view)
        return includeCollection.concat(objectView.generateIncludes({ includeTypes }))
      }, []))
    }, [])
  }
}
