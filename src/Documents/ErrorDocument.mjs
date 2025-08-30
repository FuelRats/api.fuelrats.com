import {
  InternalServerError,
  APIError,
  MethodNotAllowedAPIError,
  UnprocessableEntityAPIError, ConflictAPIError, ForbiddenAPIError, BadRequestAPIError,
} from '../classes/APIError'
import StatusCode from '../classes/StatusCode'
import logger from '../logging'
import Query from '../query'
import Document from './Document'

/**
 * @classdesc A JSONAPI document render for request errors
 * @class
 * @augments {Document}
 */
export default // noinspection JSClosureCompilerSyntax
class ErrorDocument extends Document {
  #query = undefined
  #errors = undefined

  /**
   * Create a JSONAPI Error document
   * @param {object} arg function arguments object
   * @param {Query} arg.query request query
   * @param {[Error]|Error} arg.errors the errors to include in the document
   */
  constructor ({ query, errors }) {
    // eslint-disable-next-line no-console
    console.log(errors)
    let errorList = errors
    if (Array.isArray(errorList) === false) {
      errorList = [errorList]
    }

    errorList = errorList.reduce((errorAcc, error) => {
      switch (true) {
        case (error instanceof APIError):
          errorAcc.push(error)
          break

        case (error.name === 'SequelizeValidationError'):
          errorAcc.push(...error.errors.map((validationError) => {
            return new UnprocessableEntityAPIError({
              pointer: `/data/attributes/${validationError.path}`,
            })
          }))
          break

        case (error.name === 'SequelizeDatabaseError'):
          errorAcc.push(new UnprocessableEntityAPIError({
            parameter: 'filter',
          }))
          break

        case (error.name === 'SequelizeForeignKeyConstraintError'):
          errorAcc.push(new UnprocessableEntityAPIError({
            pointer: '/data/id',
          }))
          break

        case (error.name === 'SequelizeUniqueConstraintError'):
          errorAcc.push(...error.errors.map((validationError) => {
            const pointer = validationError.path === 'id' ? '/data/id' : `/data/attributes/${validationError.path}`
            return new ConflictAPIError({
              pointer,
            })
          }))
          break

        case (error.name === 'ForbiddenError' && error.message.includes('Unable to load OAuth 2.0 transaction')):
          errorAcc.push(new ForbiddenAPIError({
            parameter: 'transaction_id',
          }))
          break

        case (error.name === 'MethodNotAllowedError'):
          errorAcc.push(new MethodNotAllowedAPIError({}))
          break

        case (error.message.includes('Invalid value')):
          errorAcc.push(new BadRequestAPIError({ parameter: 'filter' }))
          break

        default: {
          const serverError = new InternalServerError({})
          logger.error({
            GELF: true,
            _event: 'error',
            _error_id: serverError.id.toString(),
            _error_message: error.message,
            _stack: error.stack,
          }, `Server Error: ${error.message}`)
          errorAcc.push(serverError)
        }
      }

      return errorAcc
    }, [])

    for (const error of errorList) {
      if (error instanceof Error && (error instanceof InternalServerError) === false) {
        logger.info({
          GELF: true,
          _event: 'error',
          _error_id: error.id.toString(),
          _error_message: error.message,
          _stack: error.stack,
        }, `Server Error: ${error.message}`)
      }
    }

    super({
      objects: undefined,
      meta: query.meta,
      query,
    })
    this.#query = query
    this.#errors = errorList
  }

  /**
   * Get the list of error views
   * @returns {*} error views
   */
  get errors () {
    return this.#errors
  }

  /**
   * Get the overall HTTP status code for this document
   * @returns {number} HTTP status code
   */
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
