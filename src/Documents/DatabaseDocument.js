import Document, { DocumentViewType } from '.'

/**
 * @classdesc A JSONAPI document render for Sequelize database results
 * @class
 * @augments {Document}
 */
export default class DatabaseDocument extends Document {
  #result = undefined
  #query = undefined

  /**
   * Create a JSONAPI document from a database result
   * @param query the request query for this document
   * @param result database result
   * @param type the resource type
   * @param view A DocumentViewType enum describing the type of view this document should have
   * @param [meta] extra metdata
   * @constructor
   */
  constructor ({ query, result, type, view, meta = {} }) {
    if (result && result.rows) {
      super({
        objects: result.rows,
        type,
        meta: { ...meta, ...query.meta },
        query,
        view: view || DocumentViewType.collection
      })
    } else {
      super({
        objects: result,
        type,
        meta: { ...meta, ...query.meta },
        query,
        view: view || DocumentViewType.individual
      })
    }

    this.#result = result
    this.#query = query
  }

  /**
   * @inheritDoc
   */
  get firstPage () {
    if (!this.#result || !this.#result.rows || this.#result.count === 0) {
      return undefined
    }

    return 1
  }

  /**
   * @inheritDoc
   */
  get lastPage () {
    if (!this.#result || !this.#result.rows || this.#result.count === 0) {
      return undefined
    }
    return Math.floor(this.#result.count / this.#query.limit)
  }

  /**
   * @inheritDoc
   */
  get currentPage () {
    if (!this.#result || !this.#result.rows) {
      return undefined
    }

    return (this.#query.offset + this.#query.limit) / this.#query.limit
  }

  /**
   * @inheritDoc
   */
  get previousPage () {
    if (!this.#result || !this.#result.rows) {
      return undefined
    }

    const { currentPage } = this
    if (currentPage === 1) {
      return undefined
    }
    return currentPage - 1
  }

  /**
   * @inheritDoc
   */
  get nextPage () {
    if (!this.#result || !this.#result.rows) {
      return undefined
    }

    const { currentPage, lastPage } = this
    if (currentPage === lastPage) {
      return undefined
    }
    return currentPage + 1
  }

  /**
   * @inheritDoc
   */
  get offset () {
    if (!this.#result || !this.#result.rows) {
      return undefined
    }

    return this.#query.offset
  }

  /**
   * @inheritDoc
   */
  get limit () {
    if (!this.#result || !this.#result.rows) {
      return undefined
    }

    return this.#query.limit
  }

  /**
   * @inheritDoc
   */
  get count () {
    if (!this.#result || !this.#result.rows) {
      return undefined
    }

    return this.#result.rows.length
  }

  /**
   * @inheritDoc
   */
  get total () {
    if (!this.#result || !this.#result.rows) {
      return undefined
    }

    return this.#result.count
  }
}
