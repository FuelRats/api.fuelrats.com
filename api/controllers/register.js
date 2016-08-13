'use strict'

let User = require('../db').User
let Rat = require('../db').Rat
let Errors = require('../errors')
let bcrypt = require('bcrypt')
let passport = require('passport')


exports.get = function (request, response) {
  response.redirect('/login')
}

exports.post = function (request, response, next) {
  let referer = request.get('Referer')

  new Promise(function (resolve, reject) {
    let email = request.body.email
    let platform = request.body.platform
    let CMDRname = request.body.CMDRname
    let password = request.body.password

    let fields = {
      email: email,
      platform: platform,
      CMDRname: CMDRname,
      password: password
    }

    for (let fieldName of Object.keys(fields)) {
      let field = fields[fieldName]
      if (!field) {
        reject(Errors.throw('missing_required_field', fieldName))
        return
      }
    }

    let platforms = ['pc', 'xb']

    email = email.trim()
    if (platforms.indexOf(platform) === -1) {
      reject(Errors.throw('invalid_parameter', 'platform'))
      return
    }

    User.findOne({ where: {
      email: { $iLike: email }
    }}).then(function (user) {
      if (user) {
        reject(Errors.throw('already_exists', 'email'))
        return
      }

      bcrypt.hash(password, 16, function (error, hash) {
        User.create({
          email: email,
          password: hash
        }).then(function (user) {
          Rat.findOne({
            where: { CMDRname: { $iLike: CMDRname } }
          }).then(function (rat) {
            if (rat) {
              if (rat.UserId !== null) {
                user.destroy()
                reject(Errors.throw('already_exists', 'CMDRname'))
                return
              }

              authenticateAndReturnUser(request, rat, user).then(function (user) {
                resolve(user)
              }).catch(function (error) {
                user.destroy()
                reject(Errors.throw('server_error', error))
              })
            } else {
              Rat.create({
                CMDRname: CMDRname,
                platform: platform
              }).then(function (rat) {
                authenticateAndReturnUser(request, rat, user).then(function (user) {
                  resolve(user)
                }).catch(function (error) {
                  user.destroy()
                  reject(Errors.throw('server_error', error))
                })
              }).catch(function (error) {
                user.destroy()
                reject(Errors.throw('server_error', error))
              })
            }
          }).catch(function (error) {
            reject(Errors.throw('server_error', error))
          })
        }).catch(function (error) {
          reject(Errors.throw('server_error', error))
        })
      })

    }).catch(function (error) {
      reject(Errors.throw('server_error', error))
    })
  }).then(function (user) {
    if (referer) {
      response.redirect('/welcome')
    } else {
      response.model.data = user
      response.status = 201
      next()
    }
  }).catch(function (error) {
    console.log(error)
    if (referer) {
      response.redirect('/login?registrationError=1')
    } else {
      response.model.errors.push(error)
      response.status(error.code)
      next()
    }
  })
}

function authenticateAndReturnUser (req, rat, user) {
  return new Promise(function (resolve, reject) {
    user.addRat(rat).then(function () {
      req.login(user, function (err) {
        if (err) {
          reject(Errors.throw('server_error', err))
          return
        }

        resolve(req.user)
      })
    }).catch(function (error) {
      reject(Errors.throw('server_error', error))
    })
  })
}
