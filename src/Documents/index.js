import packageInfo from '../../package.json'
import config from '../../config'

const jsonApiVersion = '1.0'

export default class Document  {
  #objects = undefined
  #meta = undefined
  #type = undefined
  #query = undefined

  constructor ({ objects, type, meta = {}, query }) {
    this.#meta = meta
    this.#objects = objects
    this.#type = type
    this.#query = query
  }

  get data () {
    const { objects, type: Type } = this
    if (Array.isArray(objects)) {
      return this.objects.map((object) => {
        return (new Type({ object, query: this.query })).view
      })
    } else {
      return (new Type({ object: this.objects, query: this.query })).view
    }
  }

  get objects () {
    return this.#objects
  }

  get type () {
    return this.#type
  }

  get query () {
    return this.#query
  }

  get errors () {
    return undefined
  }

  get meta () {
    return this.#meta
  }

  get included () {
    let { objects, type: Type } = this
    if (!Array.isArray(objects)) {
      objects = [objects]
    }

    const includes = objects.reduce((acc, object) => {
      return acc.concat((new Type({ object })).generateIncludes({}))
    }, [])

    return Object.values(includes.reduce((acc, include) => {
      acc[include.id] = include
      return acc
    }, {}))
  }

  get links () {
    return {
      self: `${config.externalUrl}/${this.type.type}`
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
