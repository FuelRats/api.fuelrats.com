'use strict'
let Client = require('../models/client')
let User = require('../models/user')
let Token = require('../models/token')
let passport = require('passport')
let LocalStrategy = require('passport-local')
let BearerStrategy = require('passport-http-bearer').Strategy


passport.use(new BearerStrategy(
  function (accessToken, callback) {
    Token.findOne({value: accessToken }, function (err, token) {
      if (err) {
        console.log(err)
        return callback(err)
      }

      if (!token) {
        return callback(null, false)
      }

      callback(null, token.user, { scope: '*' })
    })
  }
))

exports.isBearerAuthenticated = passport.authenticate('bearer', { session: false })
exports.isAuthenticated = passport.authenticate(['local', 'bearer'], { session : false })

// http://localhost:3000/api/oauth2/authorize?client_id=this_is_my_id&response_type=code&redirect_uri=http://localhost:3000

// http://localhost:8080/oauth2/authorise?client_id=RatTracker&response_type=code&redirect_uri=rattracker://test
