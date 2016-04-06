'use strict'
let Client = require('../models/client')
let User = require('../models/user')
let requireLogin = require('connect-ensure-login')
let Token = require('../models/token')
let passport = require('passport')
let BasicStrategy = require('passport-http').BasicStrategy
let BearerStrategy = require('passport-http-bearer').Strategy

passport.use('client-basic', new BasicStrategy(
  function (username, password, callback) {
    console.log('test')
    Client.findOne({ name: username }, function (err, client) {
      if (err) {
        console.log(err)
        return callback(err)
      }

      if (!client) {
        console.log('no client')
        return callback(null, false)
      }

      console.log('authenticating')
      client.authenticate(password, callback)
    })
  }
))


passport.use(new BearerStrategy(
  function (accessToken, callback) {
    console.log('bearer')
    Token.findOne({value: accessToken }, function (err, token) {
      if (err) {
        console.log('error')
        return callback(err)
      }

      if (!token) {
        console.log('no token')
        return callback(null, false)
      }

      console.log('success')
      callback(null, token.user, { scope: '*' })
    })
  }
))

exports.isClientAuthenticated = passport.authenticate('client-basic', { session : false })
exports.isBearerAuthenticated = passport.authenticate('bearer', { session: false })
exports.isAuthenticated = function (req, res, next) {
  console.log(req.isUnauthenticated())
  if (req.user) {
    return next()
  } else {
    console.log('bearer')
    req.session.returnTo = req.path
    return passport.authenticate('bearer', { session : false, failureRedirect: '/login' })(req, res, next)
  }
}

// http://localhost:3000/api/oauth2/authorize?client_id=this_is_my_id&response_type=code&redirect_uri=http://localhost:3000

// http://localhost:8080/oauth2/authorise?client_id=RatTracker&response_type=code&redirect_uri=rattracker://test
