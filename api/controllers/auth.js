'use strict'
<<<<<<< HEAD
let passport = require('passport')
let BasicStrategy = require('passport-http').BasicStrategy
let BearerStrategy = require('passport-http-bearer').Strategy
let ClientPasswordStrategy = require('passport-oauth2-client-password').Strategy
let crypto = require('crypto')
let LocalStrategy = require('passport-local').Strategy
let User = require('../db').User
let Rat = require('../db').Rat
let db = require('../db').db
let Token = require('../db').Token
let Client = require('../db').Client
let bcrypt = require('bcrypt')
let Permission = require('../permission')


exports.passwordAuthenticate = function (email, password, done) {
  if (!email || !password) {
    done(null, false, { message: 'Incorrect username/email.' })
  }
=======
const User = require('../db').User
const Rat = require('../db').Rat
const db = require('../db').db
const Token = require('../db').Token
const Client = require('../db').Client
const Error = require('../errors')
const bcrypt = require('bcrypt')
const Permission = require('../permission')
const UsersPresenter = require('../classes/Presenters').UsersPresenter
const ClientsPresenter = require('../classes/Presenters').ClientsPresenter
let config = require('../../config')

const bearerTokenHeaderOffset = 7
const basicAuthHeaderOffset = 6

class Authentication {
  static async passwordAuthenticate (email, password) {
    if (!email || !password) {
      return null
    }
>>>>>>> v2

    let user = await User.scope('internal').findOne({where: {email: {$iLike: email}}})
    if (!user) {
      return null
    }

    let result = await bcrypt.compare(password, user.password)
    if (result === false) {
      return null
    } else {
<<<<<<< HEAD
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
}


exports.LocalStrategy = new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password',
  session: false
},
  exports.passwordAuthenticate
)

passport.use(exports.LocalStrategy)




exports.clientPasswordAuthentication = function (username, secret, callback) {
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

passport.use('client-basic', new BasicStrategy(
  exports.clientPasswordAuthentication
))

passport.use(new ClientPasswordStrategy(exports.clientPasswordAuthentication))
passport.use(new BearerStrategy(bearerAuthenticate))

exports.isClientAuthenticated = passport.authenticate('client-basic', { session : false })
exports.isBearerAuthenticated = passport.authenticate('bearer', { session: false })
exports.isAuthenticated = function (isUserFacing, anonymous = false) {
  return function (req, res, next) {
    if (req.user) {
      req.session.returnTo = null
      return next()
    } else {
      if (req.query.bearer) {
        bearerAuthenticate(req.query.bearer, function (error, user) {
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
=======
      if (bcrypt.getRounds(user.password) > 12) {
        let newRoundPassword = await bcrypt.hash(password, 12)
        User.update({
          password: newRoundPassword
        }, {
          where: { id: user.id }
>>>>>>> v2
        })
      }
<<<<<<< HEAD

      passport.authenticate('bearer', { session : false }, function (error, user) {
        if (!user) {
          if (anonymous) {
            return next()
          }
          if (!isUserFacing) {
            let error = Permission.authenticationError()
            res.model.errors.push(error)
            res.status(error.code)

            return next(error)
          } else {
            req.session.returnTo = req.originalUrl || req.url

            if (req.session.legacy || isUserFacing) {
              return res.redirect('/login')
            } else {
              res.model.data = req.user
              res.status(200)
              next()
              return
            }
          }
        }
        req.user = user
        next()
      })(req, res, next)
=======
      return UsersPresenter.render(user, {})
>>>>>>> v2
    }
  }

  static async bearerAuthenticate (bearer) {
    let token = await Token.findOne({ where: { value: bearer } })
    if (!token) {
      return false
    }
    let userInstance = await User.scope('internal').findOne({
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

    let user = UsersPresenter.render(userInstance, {})
    return {
      user: user,
      scope: token.scope
    }
  }

  static async clientAuthenticate (clientId, secret) {
    let client = await Client.findById(clientId)
    if (!client) {
      return null
    }

    let authorised = await bcrypt.compare(secret, client.secret)
    if (authorised) {
      if (bcrypt.getRounds(client.secret) > 12) {
        let newRoundSecret = await bcrypt.hash(secret, 12)
        Client.update({
          secret: newRoundSecret
        }, {
          where: { id: client.id }
        })
      }
      return ClientsPresenter.render(client, {})
    }
    return false
  }

  static async authenticate (ctx, next) {
    let [ clientId, clientSecret ] = getBasicAuth(ctx)
    if (clientId) {
      ctx.state.client = await Authentication.clientAuthenticate(clientId, clientSecret)
      ctx.state.user = ctx.state.client
      return next()
    }

    if (ctx.session.userId) {
      let user = await User.scope('internal').findOne({where: { id: ctx.session.userId }})
      if (user) {
        ctx.state.user = UsersPresenter.render(user, {})
        return next()
      }
    }

    let bearerToken = getBearerToken(ctx)
    if (bearerToken) {
      let bearerCheck = await Authentication.bearerAuthenticate(bearerToken)
      if (bearerCheck) {
        ctx.state.user = bearerCheck.user
        ctx.state.scope = bearerCheck.scope
        return next()
      }
    }
    await next()
  }

  static isAuthenticated (ctx, next) {
    if (ctx.state.user) {
      return next()
    } else {
      throw Error.template('not_authenticated')
    }
  }

  static isAuthenticatedRedirect (ctx, next) {
    if (ctx.state.user) {
      return next()
    } else {
      ctx.session.redirect = ctx.request.path
      ctx.redirect('/login')
    }
  }

  static isWhitelisted (ctx, next) {
    if (config.whitelist.includes(ctx.inet)) {
      return next()
    } else {
      throw Error.template('webhook_unauthorised')
    }
  }

  static async isClientAuthenticated (ctx, next) {
    if (ctx.state.client) {
      await next()
    } else {
      throw Error.template('client_unauthorised')
    }
  }
}

function getBearerToken (ctx) {
  if (ctx.query.bearer) {
    return ctx.query.bearer
  } else if (ctx.get('Authorization')) {
    let authorizationHeader = ctx.get('Authorization')
    if (authorizationHeader.startsWith('Bearer ') && authorizationHeader.length > bearerTokenHeaderOffset) {
      return authorizationHeader.substring(bearerTokenHeaderOffset)
    }
  }
  return null
}

function getBasicAuth (ctx) {
  let authorizationHeader = ctx.get('Authorization')
  if (authorizationHeader.startsWith('Basic ') && authorizationHeader.length > basicAuthHeaderOffset) {
    let authString = Buffer.from(authorizationHeader.substring(basicAuthHeaderOffset), 'base64').toString('utf8')
    return authString.split(':')
  }
  return []
}

module.exports = Authentication