'use strict'
let Action = require('../db').Action

exports.get = function (request, response) {
  if (request.isUnauthenticated()) {
    request.session.legacy = true
    response.render('login.swig', request.query)
  } else {
    Action.create({
      inet: request.inet,
      type: 'login',
      userId: request.user.id
    })
    if (request.session.returnTo) {
      response.redirect(request.session.returnTo)
      delete request.session.returnTo
    } else {
      response.redirect('/welcome')
    }
  }
}





exports.post = function (request, response, next) {
  request.session.userIp = request.headers['x-Forwarded-For'] || request.connection.remoteAddress

  request.session.errorCode = 401 // This could signify that the login has failed
  response.redirect('/login?error_login=1')
}
