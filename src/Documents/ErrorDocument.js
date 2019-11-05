import Document, { DocumentViewType } from '.'
import { InternalServerError, APIError } from '../classes/APIError'
import StatusCode from '../classes/StatusCode'

/**
 * @classdesc A JSONAPI document render for request errors
 * @class
 * @augments {Document}
 */
export default class ErrorDocument extends Document {
  #query = undefined
  #errors = undefined

  constructor ({ query, errors }) {
    let errorList = errors
    if (Array.isArray(errorList) === false) {
      errorList = [errorList]
    }

    // if (Reflect.has(errors, 'name')) {
    //   errorList = APIError.fromValidationError(errors)
    // }

    errorList = errorList.map((error) => {
      if ((error instanceof APIError) === false) {
        return new InternalServerError({})
      }
      return error
    })

    super({
      objects: undefined,
      meta: query.meta,
      query
    })
    this.#query = query
    this.#errors = errorList
  }

  get errors () {
    return this.#errors
  }

  get httpStatus () {
    if (this.#errors.length > 0) {
      return this.#errors[0].code
    }
    return StatusCode.internalServerError
  }


  /**
   * @inheritdoc
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
