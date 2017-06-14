'use strict'
const passport = require('passport')
const BasicStrategy = require('passport-http').BasicStrategy
const BearerStrategy = require('passport-http-bearer').Strategy
const LocalStrategy = require('passport-local').Strategy
const User = require('../db').User
const Rat = require('../db').Rat
const db = require('../db').db
const Token = require('../db').Token
const Client = require('../db').Client
const bcrypt = require('bcrypt')
const Permission = require('../permission')
const UserResult = require('../Results/user')

exports.LocalStrategy = new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password',
  session: false
},
async function (email, password, done) {
  if (!email || !password) {
    done(null, false, { message: 'Incorrect username/email.' })
  }

  let user = await User.findOne({ where: { email: { $iLike: email }}})
  if (!user) {
    done(null, false, { message: 'Incorrect username/email.' })
    return
  }

  try {
    let result = await bcrypt.compare(password, user.password)
    if (result === false) {
      done(false)
    } else {
      done(null, new UserResult(user).toResponse())
    }
  } catch (err) {
    done(err)
  }
})

passport.use(exports.LocalStrategy)

passport.use('client-basic', new BasicStrategy(
  async function (username, secret, callback) {
    let client = await Client.findById(username)
    if (!client) {
      callback(null, false)
    }

    try {
      let result = await bcrypt.compare(secret, client.secret)
      if (result === false) {
        callback(null, false)
      } else {
        callback(null, client)
      }
    } catch (err) {
      callback(null, err)
    }
  }
))


passport.use(new BearerStrategy(async function (token, done) {
  try {
    let tokenResult = await bearerAuthenticate(token)
    done(null, tokenResult)
  } catch (err) {
    if (err === false) {
      done(null, false)
    } else {
      done(err)
    }
  }
}))

exports.isClientAuthenticated = passport.authenticate('client-basic', { session : false })
exports.isBearerAuthenticated = passport.authenticate('bearer', { session: false })
exports.isAuthenticated = function () {
  return async function (req, res, next) {
    if (req.user) {
      req.session.returnTo = null
      return next()
    } else {
      if (req.query.bearer) {
        let authenticated = await bearerAuthenticate(req.query.bearer)
        if (authenticated.user) {
          req.user = authenticated.user
          req.scope = authenticated.scope
          next()
        } else {
          let error = Permission.authenticationError()
          res.model.errors.push(error)
          res.status(error.code)

          return next(error)
        }
        delete req.query.bearer
        return
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
}

async function bearerAuthenticate (accessToken) {
  let token = await Token.findOne({ where: { value: accessToken } })
  if (!token) {
    throw(false)
  }
  let userInstance = await User.findOne({
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
  })

  let user = new UserResult(userInstance).toResponse()
  return {
    user: user,
    scope: token.scope
  }
}
