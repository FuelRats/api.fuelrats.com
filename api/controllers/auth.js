'use strict'
let passport = require('passport')
let BasicStrategy = require('passport-http').BasicStrategy
let BearerStrategy = require('passport-http-bearer').Strategy
let LocalStrategy = require('passport-local').Strategy
let User = require('../db').User
let Rat = require('../db').Rat
let db = require('../db').db
let Token = require('../db').Token
let Client = require('../db').Client
let bcrypt = require('bcrypt')
let Permission = require('../permission')
let UserResult = require('../Results/user')

exports.LocalStrategy = new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password',
  session: false
},
function (email, password, done) {
  if (!email || !password) {
    done(null, false, { message: 'Incorrect username/email.' })
  }

  User.findOne({ where: { email: { $iLike: email }}}).then(function (user) {
    if (!user) {
      done(null, false, { message: 'Incorrect username/email.' })
      return
    }

    bcrypt.compare(password, user.password, function (err, res) {
      if (err) {
        done(err)
      } else if (res === false) {
        done(false)
      } else {
        done(null, new UserResult(user).toResponse())
      }
    })
  }).catch(function (err) {
    done(err)
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


passport.use(new BearerStrategy(bearerAuthenticate))

exports.isClientAuthenticated = passport.authenticate('client-basic', { session : false })
exports.isBearerAuthenticated = passport.authenticate('bearer', { session: false })
exports.isAuthenticated = function (req, res, next) {
  if (req.user) {
    req.session.returnTo = null
    return next()
  } else {
    if (req.query.bearer) {
      req.headers.Authorization = 'Bearer ' + req.query.bearer
      delete req.query.bearer
    }

    passport.authenticate('bearer', { session : false }, function (error, user, options) {
      if (!user) {
        return next(Permission.authenticationError())
      }
      req.scope = options.scope
      req.user = user
      next()
    })(req, res, next)
  }
}

exports.isJiraAuthenticated = function () {
  return function (req, res, next) {
    let bearer = req.query.bearer
    delete req.query.bearer
    if (!bearer) {
      let error = Permission.authenticationError()
      res.model.errors.push(error)
      res.status(error.code)
      return next(error)
    }

    bearerAuthenticate(bearer, function (error, user) {
      if (error) {
        res.model.errors.push(error)
        res.status = error.code
        return next(error)
      }

      if (user) {
        req.user = user
        next()
      } else {
        let error = Permission.authenticationError()
        res.model.errors.push(error)
        res.status(error.code)

        return next(error)
      }
    })
  }
}

function bearerAuthenticate (accessToken, callback) {
  Token.findOne({ where: { value: accessToken } }).then(function (token) {
    if (!token) {
      callback(null, false)
      return
    }
    User.findOne({
      where: { id: token.userId },
      attributes: {
        include: [
          [db.cast(db.col('nicknames'), 'text[]'), 'nicknames']
        ],
        exclude: [
          'nicknames'
        ]
      },
      include: [
        {
          model: Rat,
          as: 'rats',
          required: false
        }
      ]
    }).then(function (userInstance) {
      let user = new UserResult(userInstance).toResponse()
      callback(null, user, { scope: token.scope })
    }).catch(function (error) {
      callback(error)
    })
  }).catch(function (error) {
    callback(error)
  })
}
