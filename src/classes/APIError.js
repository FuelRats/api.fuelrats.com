
import i18next from 'i18next'
import localisationResources from '../../localisations.json'
import uuidV4 from 'uuid/v4'

i18next.init({
  lng: 'en',
  resources:  localisationResources,
})

export class APIError  extends Error {
  constructor (status, source) {
    super()

    this.id = uuidV4()
    this.code = status
    this.source = source
  }

  get status () {
    return i18next.t(`${this.code}.code`)
  }

  get title () {
    return i18next.t(`${this.code}.title`)
  }

  get detail () {
    return i18next.t(`${this.code}.detail`)
  }

  get links () {
    return {
      about: `https://httpstatuses.com/${this.code}`
    }
  }

  toJSON () {
    return {
      id:     this.id,
      links:  this.links,
      status: this.status,
      code:   this.code,
      title:  this.title,

      detail: this.detail,
      source: this.source
    }
  }

  static fromValidationError (validationError) {
    return validationError.errors.map(error => {
      return new UnprocessableEntityAPIError({
        pointer: `/data/attributes/${error.path}`
      })
    })
  }
}

export class BadRequestAPIError extends APIError {
  constructor (source) {
    super('bad_request', source)
  }
}

export class UnauthorizedAPIError extends APIError {
  constructor (source) {
    super('unauthorized', source)
  }
}

export class ForbiddenAPIError extends APIError {
  constructor (source) {
    super('forbidden', source)
  }
}

export class ResetRequiredAPIError extends APIError {
  constructor (source) {
    super('resetrequired', source)
  }
}

export class NotFoundAPIError extends APIError {
  constructor (source) {
    super('not_found', source)
  }
}

export class ConflictAPIError extends APIError {
  constructor (source) {
    super('conflict', source)
  }
}

export class GoneAPIError extends APIError {
  constructor (source) {
    super('gone', source)
  }
}

export class PayloadTooLargeAPIError extends APIError {
  constructor (source) {
    super('payload_too_large', source)
  }
}

export class UnsupportedMediaAPIError extends APIError {
  constructor (source) {
    super('unsupported_media_type', source)
  }
}

export class ImATeapotAPIError extends APIError {
  constructor (source) {
    super('im_a_teapot', source)
  }
}

export class UnprocessableEntityAPIError extends APIError {
  constructor (source) {
    super('unprocessable_entity', source)
  }
}

export class TooManyRequestsAPIError extends APIError {
  constructor (source) {
    super('too_many_requests', source)
  }
}

export class InternalServerError extends APIError {
  constructor (source) {
    super('internal_server', source)
  }
}

export class NotImplementedAPIError extends APIError {
  constructor (source) {
    super('not_implemented', source)
  }
}
