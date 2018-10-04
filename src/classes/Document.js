import packageInfo from '../../package.json'
import config from '../../config'

const jsonApiVersion = '1.0'

export default class Document  {
  #objects = null
  #meta = null
  #type = null

  constructor ({ objects, type, meta = {} }) {
    this.#meta = meta
    this.#objects = objects
    this.#type = type
  }

  get data () {
    if (Array.isArray(this.#objects)) {
      return this.#objects.map((object) => {
        return (new this.#type({ object })).view
      })
    } else {
      return (new this.#type({ object: this.#objects })).view
    }
  }

  get errors () {
    return null
  }

  get meta () {
    return {}
  }

  get included () {
    let objects = this.#objects
    if (!Array.isArray(objects)) {
      objects = [objects]
    }

    const includes = objects.reduce((acc, object) => {
      return acc.concat((new this.#type({ object })).generateIncludes({}))
    }, [])

    return Object.values(includes.reduce((acc, include) => {
      acc[include.id] = include
      return acc
    }, {}))
  }

  get links () {
    return {
      self: `${config.externalUrl}/${this.#type.type}`
    }
  }

  get jsonapi () {
    return {
      version: jsonApiVersion,
      meta: {
        apiVersion: packageInfo.version
      }
    }
  }

  get document () {
    if (this.errors) {
      return {
        errors: this.errors,
        meta: this.meta,
        links: this.links,
        jsonapi: this.jsonapi
      }
    }
    return {
      data: this.data,
      meta: this.meta,
      links: this.links,
      included: this.included,
      jsonapi: this.jsonapi
    }
  }

  toString () {
    return JSON.stringify(this.document)
  }
}
