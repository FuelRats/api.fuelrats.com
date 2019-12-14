import packageInfo from '../../package.json'
import config from '../../config'
import enumerable from '../classes/Enum'
import View from '../view'
import Query from '../query'

const jsonApiVersion = '1.0'

/**
 * @classdesc A JSONAPI Document renderer
 * @class
 */
export default class Document  {
  #objects = undefined
  #meta = undefined
  #type = undefined
  #query = undefined
  #view = undefined

  /**
   * Create a JSONAPI Document
   * @param {object} arg function arguments object
   * @param {[object]} arg.objects result object(s) to create a jsonapi document from
   * @param {View} arg.type the resource type of objects in this document
   * @param {object} arg.meta meta data
   * @param {Query} arg.query the request query to use in this document
   * @param {DocumentViewType} arg.view A DocumentViewType enum describing the type of view this document should have
   */
  constructor ({ objects, type, meta = {}, query, view = DocumentViewType.collection }) {
    this.#meta = meta
    this.#objects = objects
    this.#type = type
    this.#query = query
    this.#view = view
  }

  /**
   * Get the data section of a JSONAPI document
   * @returns {*} the data section of a JSONAPI document
   */
  get data () {
    switch (this.#view) {
      case DocumentViewType.individual:
        return (new this.#type({ object: this.objects, query: this.#query })).render()

      case DocumentViewType.relationship:
        if (Array.isArray(this.#objects)) {
          return this.objects.map((object) => {
            return (new this.#type({ object, query: this.#query })).relationshipView
          })
        } else if (this.#objects) {
          return (new this.#type({ object: this.objects, query: this.#query })).relationshipView
        }
        return undefined

      default:
        return this.objects.map((object) => {
          return (new this.#type({ object, query: this.#query })).render()
        })
    }
  }

  /**
   * Get the result object(s) of a jsonapi document
   * @returns {Array|*} result object(s) of a JSONAPI document
   */
  get objects () {
    return this.#objects
  }

  /**
   * Get the resource type of a JSONAPI document
   * @returns {string} the resource type of a JSONAPI document
   */
  get type () {
    return this.#type
  }

  /**
   * Get the query used to create the JSONAPI document
   * @returns {Query} the query used to create the JSONAPI document
   */
  get query () {
    return this.#query
  }

  /**
   * Get the errors section of the JSONAPI document
   * @returns {Array} the errors section of the JSONAPI document
   */
  get errors () {
    return undefined
  }

  /**
   * Get the meta section of the JSONAPI document
   * @returns {*} the meta section of the JSONAPI document
   */
  get meta () {
    if (this.#view === DocumentViewType.individual) {
      return this.#meta
    }

    return { ...this.#meta, ...this.pageMeta, ...this.defaultMeta }
  }

  /**
   * Get the included section ofg the JSONAPI document
   * @returns {any[]} the included section of the JSONAPI document
   */
  get included () {
    let { objects, type: Type } = this
    if (this.#view === DocumentViewType.individual) {
      objects = [objects]
    }

    const includes = objects.reduce((acc, object) => {
      return acc.concat((new Type({
        object,
        query: this.#query
      })).generateIncludes({ rootType: this.#type.type }))
    }, [])

    return Object.values(includes.reduce((acc, include) => {
      acc[include.id] = include
      return acc
    }, {}))
  }

  /**
   * Get the self link for the JSONAPI document
   * @returns {string} the self link for the JSONAPI document
   */
  get self () {
    if (this.#view === DocumentViewType.individual) {
      const singleObjectId = (new this.#type({ object: this.#objects })).id
      return `${config.server.externalUrl}/${this.#type.type}/${singleObjectId}`
    } else {
      return `${config.server.externalUrl}/${this.#type.type}`
    }
  }

  /**
   * Get the links section of the JSONAPI document
   * @returns {*} the links section of the JSONAPI document
   */
  get links () {
    return {
      self: this.currentCursor,
      first: this.firstCursor,
      last: this.lastCursor,
      previous: this.previousCursor,
      next: this.nextCursor
    }
  }

  /**
   * Get the default set of metadata for this Document
   * @returns {object} meta data
   */
  get defaultMeta () {
    let traffic = {}
    if (this.#query.connection.state.traffic) {
      const {
        total: rateLimitTotal,
        remaining: rateLimitRemaining,
        nextResetDate: rateLimitReset
      } = this.#query.connection.state.traffic

      traffic = {
        rateLimitTotal,
        rateLimitRemaining,
        rateLimitReset
      }
    }

    const meta = {
      apiVersion: packageInfo.version
    }

    return { ...meta, ...traffic }
  }

  /**
   * Get generated page meta data for the JSONAPI document
   * @returns {*} generated page meta data for the JSONAPI document
   */
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

  /**
   * Get the first page number for the results this Document represents
   * @returns {number|undefined} the first page number for the results this Document represents
   * @abstract
   */
  get firstPage () {
    throw new NotImplementedError('Document.firstPage')
  }

  /**
   * Get the last page number for the results this Document represents
   * @returns {number|undefined} the first page number for the results this Docuemnt represents
   * @abstract
   */
  get lastPage () {
    throw new NotImplementedError('Document.lastPage')
  }

  /**
   * Get the current page number for the results this Document represents
   * @returns {number|undefined} the current page number for the results this Document represents
   * @abstract
   */
  get currentPage () {
    throw new NotImplementedError('Document.currentPage')
  }

  /**
   * Get the previous page number for the results this Document represents
   * @returns {number|undefined} the previous page number for the results this Document represents
   * @abstract
   */
  get previousPage () {
    throw new NotImplementedError('Document.previousPage')
  }

  /**
   * Get the next page number for the results this Document represents
   * @returns {number|undefined} the previous page number for the results this Document represents
   * @abstract
   */
  get nextPage () {
    throw new NotImplementedError('Document.nextPage')
  }

  /**
   * Get the requested offset for this Document
   * @returns {number|undefined} the requested offset for this Document
   * @abstract
   */
  get offset () {
    throw new NotImplementedError('Document.offset')
  }

  /**
   * Get the requested limit for this Document
   * @returns {number|undefined} the requested offset for this Document
   * @abstract
   */
  get limit () {
    throw new NotImplementedError('Document.limit')
  }

  /**
   * Get the number of results displayed in this Document
   * @returns {number|undefined} the number of results in this Document
   * @abstract
   */
  get count () {
    throw new NotImplementedError('Document.count')
  }

  /**
   * The total number of results for the request this Document represents
   * @returns {number|undefined} the total number of results for the request this Document represents
   * @abstract
   */
  get total () {
    throw new NotImplementedError('Document.total')
  }

  /**
   * Generate a page cursor link from a number
   * @param {number} page a page number
   * @returns {string|undefined} A page cursor link
   */
  createPageCursor (page) {
    if (typeof page === 'undefined') {
      return undefined
    }

    return `${this.self}?page[size]=${this.#query.limit}&page[number]=${page}`
  }

  /**
   * Get the page cursor for the first page of the results this Document represents
   * @returns {string|undefined} the page cursor for the first page of the results this Document represents
   */
  get firstCursor () {
    return this.createPageCursor(this.firstPage)
  }

  /**
   * Get the page cursor for the last page of the results this Document represents
   * @returns {string|undefined} the page cursor for the last page of the results this Document represents
   */
  get lastCursor () {
    return this.createPageCursor(this.lastPage)
  }

  /**
   * Get the page cursor for the current page of the results this Document represents
   * @returns {string|undefined} the page cursor for the current page of the results this Document represents
   */
  get currentCursor () {
    return this.createPageCursor(this.currentPage)
  }

  /**
   * Get the page cursor for the previous page of results relative to the page this Document represents
   * @returns {string|undefined} the page cursor for the previous page of results relative to this page
   */
  get previousCursor () {
    return this.createPageCursor(this.previousPage)
  }

  /**
   * Get the page cursor for the next page of results relative to the page this Document represents
   * @returns {string|undefined} the page cursor for the next page of results relative to this page
   */
  get nextCursor () {
    return this.createPageCursor(this.nextPage)
  }


  /**
   * Get the JSONAPI info section of this JSONAPI Document
   * @returns {{meta: {Object}, version: string}} the JSONAPI info section of this JSONAPI Document
   */
  get jsonapi () {
    return {
      version: jsonApiVersion,
      meta: {
        apiVersion: packageInfo.version
      }
    }
  }

  /**
   * Get a rendered JSONAPI document with a data or error object
   * @returns {object} a rendered JSONAPI document with a data or error object
   */
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

  /**
   * Get a rendered JSONAPI document with only meta data information
   * @returns {object} a rendered JSONAPI document with only meta data information
   */
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

  /**
   * get a rendered JSONAPI documetn with only relationship and meta information
   * @returns {object} a rendered JSONAPI document with only relationship and meta information
   */
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

  /**
   * Get the final rendered JSONAPI document
   * @returns {object} the final rendered JSONAPI document
   */
  render () {
    switch (this.#view) {
      case DocumentViewType.meta:
        return this.metaDocument

      case DocumentViewType.relationship:
        return this.relationshipDocument

      default:
        return this.document
    }
  }

  /**
   * Get a string version of the final rendered JSONAPI document.
   * @returns {string} The final rendered JSONAPI document.
   */
  toString () {
    return JSON.stringify(this.render(), (key, value) => {
      if (typeof value === 'undefined') {
        // eslint-disable-next-line no-restricted-syntax
        return null
      }
      return value
    })
  }
}

@enumerable
/**
 * Enumerable representing the different view types a Document can have
 * @readonly
 * @enum {symbol}
 * @property {symbol} collection Document represents a collection of resources
 * @property {symbol} individual Document represents an individual requested resource
 * @property {symbol} meta Document represents only meta data for a resource
 * @property {symbol} relationship Document represents only relationships for a resource
 */
export class DocumentViewType {
  static collection
  static individual
  static meta
  static relationship
}

/**
 * Error thrown when an abstract method has not been implemented by a subclass
 */
class NotImplementedError extends Error {
  /**
   * Create a new not implemented error.
   * @param {string} description Description of the method that has not been implemented.
   */
  constructor (description) {
    super(`${description} requires implementation by subclass`)
  }
}
