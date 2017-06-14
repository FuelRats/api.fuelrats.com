'use strict'

const User = require('../db').User
const Reset = require('../db').Reset
const bcrypt = require('bcrypt')

exports.get = function (request, response) {
  if (!request.query.token) {
    response.redirect('/reset?expired=1')
  }

  Reset.findOne({
    where: {
      value: request.query.token
    }
  }).then(function (reset) {
    if (reset && reset.expires.getTime() > Date.now()) {
      response.render('change_password.swig', request.query)
    } else {
      response.redirect('/reset?expired=1')
    }
  }).catch(function () {
    response.redirect('/reset?expired=1')
  })
}


exports.post = function (request, response) {
  if (!request.body.token) {
    return response.redirect('/reset?expired=1')
  }

  Reset.findOne({
    where: {
      value: request.body.token
    }
  }).then(function (reset) {
    if (!reset || !reset.userId) {
      return response.redirect('/reset?expired=1')
    }

    bcrypt.hash(request.body.password, 16, function (error, hash) {
      if (error) {
        return response.redirect('/reset?expired=1')
      }

      User.update({
        password: hash,
        salt: null
      }, {
        where: {
          id: reset.userId
        }
      }).then(function () {
        reset.destroy()
        response.redirect('/login?password_changed=1')
      }).catch(function () {
        response.redirect('/reset?expired=1')
      })
    })
  }).catch(function () {
    response.redirect('/reset?expired=1')
  })
}
