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

      let linkObject =  {
        links: view.links
      }

      if (data && (!Array.isArray(data) || data.length > 0)) {
        linkObject.data = data
      }

      acc[key] = linkObject
      return acc
    }, {})
  }

  generateIncludes ({ includeTypes }) {
    let includes = includeTypes || this.includes

    return Object.entries(this.relationships).reduce((acc, [key, view]) => {
      let objects = this.object[key]
      if (!objects || !includes.includes(key)) {
        return acc
      }

      if (!Array.isArray(objects)) {
        objects = [objects]
      }

      return acc.concat(objects.reduce((includeCollection, object) => {
        let objectView = (new view({ object }))
        includeCollection.push(objectView.view)
        return includeCollection.concat(objectView.generateIncludes({ includeTypes }))
      }, []))
    }, [])
  }
}
