'use strict'
let Action = require('../db').Action

exports.get = function (request, response) {
  request.session.legacy = 'true'
  if (request.isUnauthenticated()) {
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
  if (request.user) {
    if (request.session.legacy || request.query.legacy) {
      return response.redirect('/login')
    } else {
      response.model.data = request.user
      response.status(200)
      next()
    }
  } else {
    request.session.userIp = request.headers['x-Forwarded-For'] || request.connection.remoteAddress

    request.session.errorCode = 401 // This could signify that the login has failed
    response.redirect('/login?error_login=1')
  }
}
