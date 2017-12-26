'use strict'
const i18next = require('i18next')
const localisationResources = require('../localisations.json')
const uuidV4 = require('uuid/v4')

i18next.init({
  lng: 'en',
  resources:  localisationResources,
})

class APIError  extends Error {
  constructor (status, source) {
    super()

    this.id = uuidV4()
    this.status = status
    this.source = source
  }

  get code () {
    return i18next.t(`${this.status}.code`)
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
      id:     this.id,
      links:  this.links,
      status: this.status,
      code:   this.code,
      title:  this.title,
      detail: this.detail,
      source: this.source
    }
  }
}

class BadRequestAPIError extends APIError {
  constructor (source) {
    super('bad_request', source)
  }
}

class UnauthorizedAPIError extends APIError {
  constructor (source) {
    super('unauthorized', source)
  }
}

class ForbiddenAPIError extends APIError {
  constructor (source) {
    super('forbidden', source)
  }
}

class NotFoundAPIError extends APIError {
  constructor (source) {
    super('not_found', source)
  }
}

class ConflictAPIError extends APIError {
  constructor (source) {
    super('conflict', source)
  }
}

class GoneAPIError extends APIError {
  constructor (source) {
    super('gone', source)
  }
}

class PayloadTooLargeAPIError extends APIError {
  constructor (source) {
    super('payload_too_large', source)
  }
}

class UnsupportedMediaAPIError extends APIError {
  constructor (source) {
    super('unsupported_media_type', source)
  }
}

class ImATeapotAPIError extends APIError {
  constructor (source) {
    super('im_a_teapot', source)
  }
}

class UnprocessableEntityAPIError extends APIError {
  constructor (source) {
    super('unprocessable_entity', source)
  }
}

class TooManyRequestsAPIError extends APIError {
  constructor (source) {
    super('too_many_requests', source)
  }
}

class InternalServerError extends APIError {
  constructor (source) {
    super('internal_server', source)
  }
}

class NotImplementedAPIError extends APIError {
  constructor (source) {
    super('not_implemented', source)
  }
}

module.exports = {
  APIError,
  BadRequestAPIError,
  UnauthorizedAPIError,
  ForbiddenAPIError,
  NotFoundAPIError,
  ConflictAPIError,
  GoneAPIError,
  PayloadTooLargeAPIError,
  UnsupportedMediaAPIError,
  ImATeapotAPIError,
  UnprocessableEntityAPIError,
  TooManyRequestsAPIError,
  InternalServerError,
  NotImplementedAPIError
}