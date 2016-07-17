'use strict'
let passport = require('passport')
let BasicStrategy = require('passport-http').BasicStrategy
let BearerStrategy = require('passport-http-bearer').Strategy
let crypto = require('crypto')
let LocalStrategy = require('passport-local').Strategy
let User = require('../db').User
let Token = require('../db').Token
let Client = require('../db').Client
let bcrypt = require('bcrypt')

exports.LocalStrategy = new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password',
  session: false
},
function (email, password, done) {
  User.findOne({ where: { email: { $iLike: email }}}).then(function (user) {
    if (!user) {
      done(null, false)
      return
    }

    if (user.salt) {
      crypto.pbkdf2(password, user.salt, 25000, 512, 'sha256', function (err, hashRaw) {
        let hash = new Buffer(hashRaw, 'binary').toString('hex')
        if (user.password === hash) {
          // Legacy password system migration
          bcrypt.hash(password, 16, function (error, convertedPassword) {
            if (error) {
              done(null, user)
              return
            }

            User.update({
              password: convertedPassword,
              salt: null
            }, {
              id: user.id
            }).then(function () {
              done(null, user)
            }).catch(function () {
              done(null, user)
            })
          })
        } else {
          done(null, false)
        }
      })
    } else {
      bcrypt.compare(password, user.password, function (err, res) {
        if (err || res === false) {
          done(null, false)
        } else {
          done(null, user)
        }
      })
    }
  }).catch(function () {
    done(null, false)
  })
})

passport.use(exports.LocalStrategy)

passport.use('client-basic', new BasicStrategy(
  function (username, secret, callback) {
    Client.findOne({ name: username }).then(function (client) {
      if (!client) {
        callback(null, false)
      }

      bcrypt.compare(secret, client.secret, function (err, res) {
        if (err || res === false) {
          callback(null, false)
        } else {
          callback(null, client)
        }
      })
    }).catch(function () {
      callback(null, false)
    })
  }
))


passport.use(new BearerStrategy(
  function (accessToken, callback) {
    Token.findOne({ value: accessToken }).then(function (token) {
      if (!token) {
        callback(null, false)
        return
      }

      callback(null, token.userId, { scope: '*' })
    }).catch(function () {
      callback(null, false)
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
