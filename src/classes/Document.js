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
    if (Array.isArray(this.#objects)) {
      return this.#objects.map((object) => {
        return (new this.#type({ object })).generateIncludes({})
      })
    } else {
      return (new this.#type({ object: this.#objects })).generateIncludes({})
    }
  }

  get links () {
    return null
  }

  get jsonapi () {
    return {
      version: '1.0'
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
