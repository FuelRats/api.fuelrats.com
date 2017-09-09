'use strict'
const Action = require('../db').Action

class SSOLogin  {
  static loginWithCredentials (request, response) {
    if (request.user) {
      Action.create({
        inet: request.inet,
        type: 'login',
        userId: request.user.id
      })
      if (request.body.redirect) {
        response.redirect(request.body.redirect)
      } else {
        response.redirect('/')
      }
    } else {
      request.session.userIp = request.headers['x-forwarded-for'] || request.connection.remoteAddress

      request.session.errorCode = 401 // This could signify that the login has failed
      response.redirect('/ssologin?error_login=1')
    }
  }
}


module.exports = SSOLogin
