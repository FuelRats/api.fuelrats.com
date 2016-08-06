'use strict'
let passport = require('passport')
let BasicStrategy = require('passport-http').BasicStrategy
let BearerStrategy = require('passport-http-bearer').Strategy
let crypto = require('crypto')
let LocalStrategy = require('passport-local').Strategy
let User = require('../db').User
let Rat = require('../db').Rat
let Token = require('../db').Token
let Client = require('../db').Client
let bcrypt = require('bcrypt')
let Permission = require('../permission')

exports.LocalStrategy = new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password',
  session: false
},
function (email, password, done) {
  findUserWithRats({ email: { $iLike: email }}).then(function (user) {
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

            let apiUser = convertUserToAPIResult(user)

            User.update({
              password: convertedPassword,
              salt: null
            }, {
              where: { id: user.id }
            }).then(function () {
              done(null, apiUser)
            }).catch(function () {
              done(null, false)
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
          done(null, convertUserToAPIResult(user))
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
    Client.findById(username).then(function (client) {
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
    }).catch(function (error) {
      callback(error)
    })
  }
))


passport.use(new BearerStrategy(
  function (accessToken, callback) {
    Token.findOne({ where: { value: accessToken } }).then(function (token) {
      if (!token) {
        callback(null, false)
        return
      }
      User.findById(token.userId).then(function (user) {
        callback(null, user, { scope: '*' })
      }).catch(function (error) {
        callback(error)
      })
    }).catch(function () {
      callback(null, false)
    })
  }
))

exports.isClientAuthenticated = passport.authenticate('client-basic', { session : false })
exports.isBearerAuthenticated = passport.authenticate('bearer', { session: false })
exports.isAuthenticated = function (isUserFacing) {
  return function (req, res, next) {
    if (req.user) {
      return next()
    } else {
      passport.authenticate('bearer', { session : false }, function (error, user) {
        if (!user) {
          if (!isUserFacing) {
            let error = Permission.authenticationError()
            res.model.errors.push(error)
            res.status(error.code)

            return next(error)
          } else {
            req.session.returnTo = req.originalUrl || req.url
            return res.redirect('/login')
          }
        }
        req.user = user
        next()
      })(req, res, next)
    }
  }
}

function findUserWithRats (where) {
  return User.findOne({
    where: where,
    include: [
      {
        model: Rat,
        as: 'rats',
        required: false
      }
    ]
  })
}

function convertUserToAPIResult (userInstance) {
  let user = userInstance.toJSON()
  let reducedRats = user.rats.map(function (rat) {
    return rat.id
  })
  user.CMDRs = reducedRats
  delete user.rats
  delete user.salt
  delete user.password

  return user
}
