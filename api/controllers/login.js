'use strict'
let Action = require('../db').Action

exports.get = function (request, response) {
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
  let user = request.user

  if (request.get('Referer')) {
    response.redirect('/login')

  } else {
    response.status(200)
    response.model.data = user
    next()
  }
}
