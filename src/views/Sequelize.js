import View from './'

export default class SequelizeView extends View {
  get id () {
    return this.object.id
  }

  generateRelationships () {
    return Object.entries(this.relationships).reduce((acc, [key, view]) => {
      let data = null
      if (Array.isArray(this.object[key])) {
        data = this.object[key].map((relation) => {
          return (new view({ object: relation })).relationshipView
        })
      } else {
        data = (new view({ object: this.object })).relationshipView
      }

      acc[key] = {
        links: view.links,
        data
      }
      return acc
    }, {})
  }

  generateIncludes ({ includeTypes }) {
    return Object.entries(this.relationships).reduce((acc, [key, view]) => {
      let objects = this.object[key]
      if (!objects) {
        return acc
      }

      if (!Array.isArray(objects)) {
        objects = [objects]
      }

      return acc.concat(objects.reduce((includeCollection, object) => {
        let objectView = (new view({ object }))
        includeCollection.push(objectView.view)
        return includeCollection.concat(objectView.generateIncludes({ }))
      }, []))
    }, [])
  }
}
