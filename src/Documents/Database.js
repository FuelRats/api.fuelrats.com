import Document from '.'

export default class DatabaseDocument extends Document {
  #result = undefined
  #query = undefined

  /**
   * Create a JSONAPI document from a database result
   * @param query the request query for this document
   * @param result database result
   * @param type the resource type
   */
  constructor ({ query, result, type }) {
    if (result.rows) {
      super({
        objects: result.rows,
        type,
        meta: query.meta,
        query,
        single: false
      })
    } else {
      super({
        objects: result,
        type,
        meta: query.meta,
        query,
        single: true
      })
    }

    this.#result = result
    this.#query = query
  }

  get firstPage () {
    if (!this.#result.rows || this.#result.count === 0) {
      return undefined
    }

    return 1
  }

  get lastPage () {
    if (!this.#result.rows || this.#result.count === 0) {
      return undefined
    }
    return Math.floor(this.#result.count / this.#query.limit)
  }

  get currentPage () {
    if (!this.#result.rows) {
      return undefined
    }

    return (this.#query.offset + this.#query.limit) / this.#query.limit
  }

  get previousPage () {
    if (!this.#result.rows) {
      return undefined
    }

    const { currentPage } = this
    if (currentPage === 1) {
      return undefined
    }
    return currentPage - 1
  }

  get nextPage () {
    if (!this.#result.rows) {
      return undefined
    }

    const { currentPage, lastPage } = this
    if (currentPage === lastPage) {
      return undefined
    }
    return currentPage + 1
  }

  get offset () {
    if (!this.#result.rows) {
      return undefined
    }

    return this.#query.offset
  }

  get limit () {
    if (!this.#result.rows) {
      return undefined
    }

    return this.#query.limit
  }

  get count () {
    if (!this.#result.rows) {
      return undefined
    }

    return this.#result.rows.length
  }

  get total () {
    if (!this.#result.rows) {
      return undefined
    }

    return this.#result.count
  }
}
