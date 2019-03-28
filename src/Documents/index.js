import packageInfo from '../../package.json'
import config from '../../config'

const jsonApiVersion = '1.0'

export default class Document  {
  #objects = undefined
  #meta = undefined
  #type = undefined
  #query = undefined
  #single = false
  #metaOnly = false
  #relationshipOnly = false

  /**
   * Create a JSONAPI Document
   * @param objects result object(s) to create a jsonapi document from
   * @param type the resource type of objects in this document
   * @param meta meta data
   * @param query the request query to use in this document
   * @param single whether the document contains a single resource or multiple resources
   * @param metaOnly whether the document should only display meta data
   * @param relationshipOnly whether the document should only display relationships
   */
  constructor ({ objects, type, meta = {}, query, single = false, metaOnly = false, relationshipOnly = false }) {
    this.#meta = meta
    this.#objects = objects
    this.#type = type
    this.#query = query
    this.#single = single
    this.#metaOnly = metaOnly
    this.#relationshipOnly = relationshipOnly
  }

  get data () {
    if (this.#single) {
      return (new this.#type({ object: this.objects, query: this.query })).view
    } else {
      return this.objects.map((object) => {
        return (new this.#type({ object, query: this.query })).view
      })
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
    if (this.#single) {
      return this.#meta
    }

    return { ...this.#meta, ...this.pageMeta }
  }

  get included () {
    let { objects, type: Type } = this
    if (this.#single) {
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

  get self () {
    if (this.#single) {
      const singleObjectId = (new this.#type({ object: this.#objects })).id
      return `${config.externalUrl}/${this.type.type}/${singleObjectId}`
    } else {
      return `${config.externalUrl}/${this.type.type}`
    }
  }

  get links () {
    return {
      self: this.currentCursor,
      first: this.firstCursor,
      last: this.lastCursor,
      previous: this.previousCursor,
      next: this.nextCursor
    }
  }

  get pageMeta () {
    return {
      page: this.currentPage,
      lastPage: this.lastPage,
      previousPage: this.previousPage,
      nextPage: this.nextPage,
      offset: this.offset,
      limit: this.limit,
      total: this.total
    }
  }

  get firstPage () {
    throw new NotImplementedError('Document.firstPage')
  }

  get lastPage () {
    throw new NotImplementedError('Document.lastPage')
  }

  get currentPage () {
    throw new NotImplementedError('Document.currentPage')
  }

  get previousPage () {
    throw new NotImplementedError('Document.previousPage')
  }

  get nextPage () {
    throw new NotImplementedError('Document.nextPage')
  }

  get offset () {
    throw new NotImplementedError('Document.offset')
  }

  get limit () {
    throw new NotImplementedError('Document.limit')
  }

  get count () {
    throw new NotImplementedError('Document.count')
  }

  get total () {
    throw new NotImplementedError('Document.total')
  }

  createPageCursor (page) {
    if (typeof page === 'undefined') {
      return undefined
    }

    return `${this.self}?page[size]=${this.#query.limit}&page[number]=${page}`
  }

  get firstCursor () {
    return this.createPageCursor(this.firstPage)
  }

  get lastCursor () {
    return this.createPageCursor(this.lastPage)
  }

  get currentCursor () {
    return this.createPageCursor(this.currentPage)
  }

  get previousCursor () {
    return this.createPageCursor(this.previousPage)
  }

  get nextCursor () {
    return this.createPageCursor(this.nextPage)
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

  get metaDocument () {
    if (this.errors) {
      return {
        errors: this.errors,
        meta: this.meta,
        links: this.links,
        jsonapi: this.jsonapi
      }
    }
    return {
      meta: this.meta,
      links: this.links,
      jsonapi: this.jsonapi
    }
  }

  get relationshipDocument () {
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
      jsonapi: this.jsonapi
    }
  }

  toString () {
    if (this.#metaOnly) {
      return JSON.stringify(this.metaDocument)
    } else if (this.#relationshipOnly) {
      return JSON.stringify(this.relationshipDocument)
    }
    return JSON.stringify(this.document)
  }
}

class NotImplementedError extends Error {
  constructor (description) {
    super(`${description} requires implementation by subclass`)
  }
}
