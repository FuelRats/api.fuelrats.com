import View from './View'

/**
 * Base class for JSONAPI Views generated from Sequelize database entries
 */
export default class DatabaseView extends View {
  /**
   * @inheritdoc
   */
  get id () {
    return this.object.id
  }

  /**
   * @inheritdoc
   */
  attributeForKey (key) {
    return this.object[key]
  }

  /**
   * @inheritdoc
   */
  generateRelationships () {
    return Object.entries(this.relationships).reduce((acc, [key, RelationshipView]) => {
      if (this.root && RelationshipView.type === this.root.type) {
        return acc
      }

      // eslint-disable-next-line no-restricted-syntax
      let data = null
      if (Reflect.has(this.object, key) === false && Reflect.has(this.object, `${key}Id`) === false) {
        data = []
      } else if (Array.isArray(this.object[key])) {
        data = this.object[key].map((relation) => {
          return (new RelationshipView({
            object: relation,
            root: this.root || this,
            query: this.query,
          })).relationshipView
        })
      } else if (this.object[key]) {
        data = (new RelationshipView({
          object: this.object[key],
          root: this.root || this,
          query: this.query,
        })).relationshipView
      }

      acc[key] = {
        links: this.getRelationLink(key),
        data,
      }
      return acc
    }, {})
  }

  /**
   * @inheritdoc
   */
  generateIncludes ({ rootType, includeTypes }) {
    const includes = includeTypes ?? this.includes

    return Object.entries(this.relationships).reduce((acc, [key, RelationshipView]) => {
      let objects = this.object[key]
      if (!objects || !includes.includes(key) || rootType === RelationshipView.type) {
        return acc
      }

      if (!Array.isArray(objects)) {
        objects = [objects]
      }

      return acc.concat(objects.reduce((includeCollection, object) => {
        const objectView = (new RelationshipView({ object, root: this.root ?? this, query: this.query }))
        includeCollection.push(objectView.view)
        return includeCollection.concat(objectView.generateIncludes({ rootType, includeTypes }))
      }, []))
    }, [])
  }

  /**
   * @inheritdoc
   * @abstract
   */
  get defaultReadPermission () {
    return undefined
  }

  /**
   * @inheritdoc
   * @abstract
   */
  get isGroup () {
    return false
  }

  /**
   * @inheritdoc
   * @abstract
   */
  get isInternal () {
    return false
  }

  /**
   * @inheritdoc
   * @abstract
   */
  get isSelf () {
    return false
  }
}
