'use strict'
let Action = require('../db').Action


exports.post = function (request, response, next) {
  if (request.user) {
    Action.create({
      inet: request.inet,
      type: 'login',
      userId: request.user.id
    })
    response.model.data = request.user
    response.status(200)
    next()
  } else {
    request.session.userIp = request.headers['x-forwarded-for'] || request.connection.remoteAddress

    request.session.errorCode = 401 // This could signify that the login has failed
    response.redirect('/login?error_login=1')
  }
}
