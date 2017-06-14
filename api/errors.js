'use strict'

let errors = {
  'bad_request': {
    'code': 400,
    'detail': 'You\'ve made a request. How naughty. :-(',
    'status': 'Bad Request'
  },

  'missing_required_field': {
    'code': 400,
    'detail': '',
    'status': 'Bad Request',
    'title': 'Missing Required Field'
  },

  'not_authenticated': {
    'code': 401,
    'detail': 'User must be authenticated to perform that action',
    'status': 'Unauthorized',
    'title': 'Not Authenticated'
  },

  'no_permission': {
    'code': 403,
    'detail': 'User does not have the required permission to perform that action',
    'status': 'Forbidden',
    'title': 'Missing Required Permissions'
  },

  'not_found': {
    'code': 404,
    'detail': 'Resource not found',
    'status': 'Not Found',
    'title': 'Resource not found'
  },

  'invalid_parameter': {
    'code': 400,
    'detail': '',
    'status': 'Bad Request',
    'title': 'Invalid Parameter'
  },


  'invalid_scope': {
    'code': 400,
    'detail': '',
    'status': 'Invalid Scope',
    'title': 'Invalid Parameter'
  },

  'server_error': {
    'code': 500,
    'detail': '',
    'status': 'Internal Server Error',
    'title': 'Server Error'
  },

  'operation_failed': {
    'code': 409,
    'detail': 'Failed to create or update resource due to a conflict',
    'status': 'Conflict',
    'title': 'Conflict During Operation'
  },

  'already_exists': {
    'code': 400,
    'detail': '',
    'status': 'Bad Request',
    'title': 'Already Exists'
  },

  'rate_limit_exceeded': {
    'code': 429,
    'detail': 'You have exceeded the number of allowed requests per hour for your IP address or user',
    'status': 'Too Many Requests',
    'title': 'Rate Limit Exceeded'
  },

  template: function (type, detail) {
    let errorModel = errors[type]
    if (detail) {
      errorModel.detail = detail
    }
    return errorModel
  }
}

module.exports = errors
