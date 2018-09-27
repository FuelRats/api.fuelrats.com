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

  generateIncludes () {
    return Object.values(Object.entries(this.relationships).reduce((acc, [key, view]) => {

    }, {}))
  }
}
