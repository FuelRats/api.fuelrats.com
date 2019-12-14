import Document, { DocumentViewType } from '.'
import View from '../view'
import Query from '../query'

/**
 * @classdesc A JSONAPI document render for Sequelize database results
 * @class
 * @augments {Document}
 */
export default // noinspection JSClosureCompilerSyntax
class DatabaseDocument extends Document {
  #result = undefined
  #query = undefined

  /**
   * Create a JSONAPI document from a database result
   * @param {object} arg fucntion arguments object
   * @param {Query} arg.query the request query for this document
   * @param {any} arg.result database result
   * @param {View} arg.type the resource type
   * @param {DocumentViewType} arg.view A DocumentViewType enum describing the type of view this document should have
   * @param {object} [arg.meta] extra metdata
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
   * @inheritdoc
   */
  get firstPage () {
    if (!this.#result || !this.#result.rows || this.#result.count === 0) {
      return undefined
    }

    return 1
  }

  /**
   * @inheritdoc
   */
  get lastPage () {
    if (!this.#result || !this.#result.rows || this.#result.count === 0) {
      return undefined
    }
    return Math.floor(this.#result.count / this.#query.limit)
  }

  /**
   * @inheritdoc
   */
  get currentPage () {
    if (!this.#result || !this.#result.rows) {
      return undefined
    }

    return (this.#query.offset + this.#query.limit) / this.#query.limit
  }

  /**
   * @inheritdoc
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
   * @inheritdoc
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
   * @inheritdoc
   */
  get offset () {
    if (!this.#result || !this.#result.rows) {
      return undefined
    }

    return this.#query.offset
  }

  /**
   * @inheritdoc
   */
  get limit () {
    if (!this.#result || !this.#result.rows) {
      return undefined
    }

    return this.#query.limit
  }

  /**
   * @inheritdoc
   */
  get count () {
    if (!this.#result || !this.#result.rows) {
      return undefined
    }

    return this.#result.rows.length
  }

  /**
   * @inheritdoc
   */
  get total () {
    if (!this.#result || !this.#result.rows) {
      return undefined
    }

    return this.#result.count
  }
}
