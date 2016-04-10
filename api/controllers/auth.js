'use strict'
let Client = require('../models/client')
let Token = require('../models/token')
let passport = require('passport')
let BasicStrategy = require('passport-http').BasicStrategy
let BearerStrategy = require('passport-http-bearer').Strategy

passport.use('client-basic', new BasicStrategy(
  function (username, password, callback) {
    Client.findOne({ name: username }, function (err, client) {
      if (err) {
        return callback(err)
      }

      if (!client) {
        return callback(null, false)
      }

      client.authenticate(password, callback)
    })
  }
))


passport.use(new BearerStrategy(
  function (accessToken, callback) {
    Token.findOne({value: accessToken }, function (err, token) {
      if (err) {
        return callback(err)
      }

      if (!token) {
        return callback(null, false)
      }

      callback(null, token.user, { scope: '*' })
    })
  }
))

exports.isClientAuthenticated = passport.authenticate('client-basic', { session : false })
exports.isBearerAuthenticated = passport.authenticate('bearer', { session: false })
exports.isAuthenticated = function (req, res, next) {
  if (req.isUnauthenticated() === false) {
    return next()
  } else {
    req.session.returnTo = req.originalUrl || req.url
    return passport.authenticate('bearer', { session : true, failureRedirect: '/login' })(req, res, next)
  }
}
