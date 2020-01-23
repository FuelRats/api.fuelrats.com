/* eslint-disable jsdoc/require-jsdoc */

import i18next from 'i18next'
import UUID from 'pure-uuid'
import StatusCode from './StatusCode'
import fs from 'fs'

const localisationResources = JSON.parse(fs.readFileSync('localisations.json', 'utf8'))

// noinspection JSIgnoredPromiseFromCall
i18next.init({
  lng: 'en',
  resources:  localisationResources
})

/**
 * @classdesc API error base class
 * @class
 */
export class APIError extends Error {
  /**
   * Create an API error instance with a jsonapi source
   * @param {object} source
   */
  constructor (source) {
    super()

    this.id = new UUID(4)
    this.source = source
  }

  /**
   * Set the HTTP status code
   * @returns {number}
   * @abstract
   */
  get code () {
    return undefined
  }

  /**
   * Set the status identifier for this error
   * @returns {string}
   * @abstract
   */
  get status () {
    return undefined
  }

  get title () {
    return i18next.t(`${this.status}.title`)
  }

  get detail () {
    return i18next.t(`${this.status}.detail`)
  }

  get links () {
    return {
      about: `https://httpstatuses.com/${this.code}`
    }
  }

  toJSON () {
    return {
      id:     this.id.format(),
      links:  this.links,
      status: this.status,
      code:   this.code,
      title:  this.title,

      detail: this.detail,
      source: this.source
    }
  }
}

export class BadRequestAPIError extends APIError {
  get code () {
    return StatusCode.badRequest
  }

  get status () {
    return 'bad_request'
  }
}

export class UnauthorizedAPIError extends APIError {
  get code () {
    return StatusCode.unauthorised
  }

  get status () {
    return 'unauthorized'
  }
}

export class ForbiddenAPIError extends APIError {
  get code () {
    return StatusCode.forbidden
  }

  get status () {
    return 'forbidden'
  }
}

export class VerificationRequiredAPIError extends APIError {
  get code () {
    return StatusCode.forbidden
  }

  get status () {
    return 'verification_required'
  }
}

export class ResetRequiredAPIError extends APIError {
  get code () {
    return StatusCode.forbidden
  }

  get status () {
    return 'reset_required'
  }
}

export class NotFoundAPIError extends APIError {
  get code () {
    return StatusCode.notFound
  }

  get status () {
    return 'not_found'
  }
}

export class MethodNotAllowedAPIError extends  APIError {
  get code () {
    return StatusCode.methodNotAllowed
  }

  get status () {
    return 'method_not_allowed'
  }
}

export class ConflictAPIError extends APIError {
  get code () {
    return StatusCode.conflict
  }

  get status () {
    return 'conflict'
  }
}

export class GoneAPIError extends APIError {
  get code () {
    return StatusCode.gone
  }

  get status () {
    return 'gone'
  }
}

export class PayloadTooLargeAPIError extends APIError {
  get code () {
    return StatusCode.payloadTooLarge
  }

  get status () {
    return 'payload_too_large'
  }
}

export class UnsupportedMediaAPIError extends APIError {
  get code () {
    return StatusCode.unsupportedMediaType
  }

  get status () {
    return 'unsupported_media_type'
  }
}

export class ImATeapotAPIError extends APIError {
  get code () {
    return StatusCode.imATeapot
  }

  get status () {
    return 'im_a_teapot'
  }
}

export class UnprocessableEntityAPIError extends APIError {
  get code () {
    return StatusCode.unprocessableEntity
  }

  get status () {
    return 'unprocessable_entity'
  }
}

export class TooManyRequestsAPIError extends APIError {
  get code () {
    return StatusCode.tooManyRequests
  }

  get status () {
    return 'too_many_requests'
  }
}

export class InternalServerError extends APIError {
  get code () {
    return StatusCode.internalServerError
  }

  get status () {
    return 'internal_server'
  }
}

export class NotImplementedAPIError extends APIError {
  get code () {
    return StatusCode.notImplemented
  }

  get status () {
    return 'not_implemented'
  }
}
