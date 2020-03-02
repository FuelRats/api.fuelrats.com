import Query from '../query'
import View from '../view'
import Document, { DocumentViewType } from './Document'

/**
 * @classdesc A JSONAPI document render for simple object results
 * @class
 * @augments {Document}
 */
export default // noinspection JSClosureCompilerSyntax
class ObjectDocument extends Document {
  #result = undefined
  #query = undefined

  /**
   * Create a JSONAPI document from a database result
   * @param {object} arg function arguments object
   * @param {Query} arg.query the request query for this document
   * @param {[object]|object} arg.result database result
   * @param {View} arg.type the resource type
   * @param {DocumentViewType} arg.view A DocumentViewType enum describing the type of view this document should have
   */
  constructor ({ query, result, type, view = DocumentViewType.collection }) {
    super({
      objects: result,
      type,
      meta: query.meta,
      query,
      view,
    })

    this.#result = result
    this.#query = query
  }

  /**
   * @inheritdoc
   */
  get firstPage () {
    return undefined
  }

  /**
   * @inheritdoc
   */
  get lastPage () {
    return undefined
  }

  /**
   * @inheritdoc
   */
  get currentPage () {
    return undefined
  }

  /**
   * @inheritdoc
   */
  get previousPage () {
    return undefined
  }

  /**
   * @inheritdoc
   */
  get nextPage () {
    return undefined
  }

  /**
   * @inheritdoc
   */
  get offset () {
    return undefined
  }

  /**
   * @inheritdoc
   */
  get limit () {
    return undefined
  }

  /**
   * @inheritdoc
   */
  get count () {
    return undefined
  }

  /**
   * @inheritdoc
   */
  get total () {
    return undefined
  }
}
