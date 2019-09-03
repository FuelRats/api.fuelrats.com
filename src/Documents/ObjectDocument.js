import Document, { DocumentViewType } from '.'

/**
 * @classdesc A JSONAPI document render for simple object results
 * @class
 * @augments {Document}
 */
export default class ObjectDocument extends Document {
  #result = undefined
  #query = undefined

  /**
   * Create a JSONAPI document from a database result
   * @param query the request query for this document
   * @param result database result
   * @param type the resource type
   * @param view A DocumentViewType enum describing the type of view this document should have
   * @constructor
   */
  constructor ({ query, result, type, view = DocumentViewType.collection }) {
    super({
      objects: result,
      type,
      meta: query.meta,
      query,
      view
    })

    this.#result = result
    this.#query = query
  }

  /**
   * @inheritDoc
   */
  get firstPage () {
    return undefined
  }

  /**
   * @inheritDoc
   */
  get lastPage () {
    return undefined
  }

  /**
   * @inheritDoc
   */
  get currentPage () {
    return undefined
  }

  /**
   * @inheritDoc
   */
  get previousPage () {
    return undefined
  }

  /**
   * @inheritDoc
   */
  get nextPage () {
    return undefined
  }

  /**
   * @inheritDoc
   */
  get offset () {
    return undefined
  }

  /**
   * @inheritDoc
   */
  get limit () {
    return undefined
  }

  /**
   * @inheritDoc
   */
  get count () {
    return undefined
  }

  /**
   * @inheritDoc
   */
  get total () {
    return undefined
  }
}
