/* eslint-disable jsdoc/require-jsdoc */

/**
 * Base class for OAuth Errors
 * @class
 */
export class OAuthError extends Error {
  constructor (description = undefined) {
    super()
    this.description = description
  }

  get error () {
    return undefined
  }

  toString () {
    return {
      error: this.error,
      error_description: this.description,
    }
  }
}

export class InvalidRequestOAuthError extends OAuthError {
  get error () {
    return 'invalid_request'
  }
}

export class UnauthorisedClientOAuthError extends OAuthError {
  get error () {
    return 'unauthorised_client'
  }
}

export class InvalidClientOAuthError extends OAuthError {
  get error () {
    return 'invalid_client'
  }
}

export class InvalidGrantOAuthError extends OAuthError {
  get error () {
    return 'invalid_grant'
  }
}

export class UnsupportedGrantTypeOAuthError extends OAuthError {
  get error () {
    return 'unsupported_grant_type'
  }
}


export class AccessDeniedOAuthError extends OAuthError {
  get error () {
    return 'access_denied'
  }
}

export class UnsupportedResponseTypeOAuthError extends OAuthError {
  get error () {
    return 'unsupported_response_type'
  }
}

export class InvalidScopeOAuthError extends OAuthError {
  get error () {
    return 'invalid_scope'
  }
}
