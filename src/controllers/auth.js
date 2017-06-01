import passport from 'passport'
import { BasicStrategy } from 'passport-http'
import { Strategy as BearerStrategy }from 'passport-http-bearer'
import { Strategy as LocalStrategy } from 'passport-local'
import { User, Rat, db, Token, Client } from '../db'
import bcrypt from 'bcrypt'
import Permission from '../permission'
import UserResult from '../Results/user'

class Authentication {
  static isAuthenticated (isUserFacing) {
    return function (req, res, next) {
      if (req.user) {
        req.session.returnTo = null
        return next()
      } else {
        if (req.query.bearer) {
          Authentication.bearerAuthenticate(req.query.bearer, function (error, user) {
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
          delete req.query.bearer
          return
        }

        passport.authenticate('bearer', { session : false }, function (error, user) {
          if (!user) {
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

  static isJiraAuthenticated () {
    return function (req, res, next) {
      let bearer = req.query.bearer
      delete req.query.bearer
      if (!bearer) {
        let error = Permission.authenticationError()
        res.model.errors.push(error)
        res.status(error.code)
        return next(error)
      }

      Authentication.bearerAuthenticate(bearer, function (error, user) {
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


  static async bearerAuthenticate (accessToken, callback) {
    try {
      let token = await Token.findOne({ where: { value: accessToken } })
      if (!token) {
        callback(null, false)
        return
      }

      let userInstance = await User.findOne({
        where: { id: token.userId },
        attributes: {
          include: [
            [db.cast(db.col('nicknames'), 'text[]'), 'nicknames']
          ],
          exclude: [ 'nicknames' ]
        },
        include: [{
          model: Rat,
          as: 'rats',
          required: false
        }]
      })

      let user = new UserResult(userInstance).toResponse()
      callback(null, user, { scope: token.scope })
    } catch (ex) {
      callback(ex)
    }
  }
}

Authentication.LocalStrategy = new LocalStrategy({
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


passport.use(new BearerStrategy(Authentication.bearerAuthenticate))

Authentication.isClientAuthenticated = passport.authenticate('client-basic', { session : false })
Authentication.isBearerAuthenticated = passport.authenticate('bearer', { session: false })

export default Authentication