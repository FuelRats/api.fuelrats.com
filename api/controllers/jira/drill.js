'use strict'

const winston = require('winston')
const HostServ = require('../../Anope/HostServ')
const BotServ = require('../../Anope/BotServ')
const db = require('../../db').db
const User = require('../../db').User
const Rat = require('../../db').Rat
const Errors = require('../../errors')

const DrillType = {
  10200: 'drilled',
  10201: 'drilledDispatch'
}
const CMDRnameField = 'customfield_10205'
const emailAddressField = 'customfield_10502'

class Controller {
  static update (data) {
    return new Promise(function (resolve, reject) {
      if (!data.issue || !data.issue.fields.issuetype || !data.issue.fields.issuetype.id) {
        return reject({ error: Errors.throw('missing_required_field', 'issue.fields.issuetype.id'), meta: {} })
      }

      let fields = data.issue.fields

      let email = fields[emailAddressField]
      if (!email) {
        BotServ.say('#doersofstuff', '[API] Unable to update drilled status or IRC permissions. Email was not provided')
        return reject({ error: Errors.throw('missing_required_field', `'issue.fields.${emailAddressField}`), meta: {} })
      }

      let CMDRname = fields[CMDRnameField]
      if (!CMDRname) {
        BotServ.say('#doersofstuff', '[API] Unable to update IRC permissions. CMDR name was not provided')
        return reject({ error: Errors.throw('missing_required_field', `'issue.fields.${CMDRnameField}`), meta: {} })
      }

      User.findOne({
        where: {
          email: {
            $iLike: email
          }
        }
      }).then(function (user) {
        let drillUpdate = {}
        drillUpdate[DrillType[fields.issuetype.id]] = true

        if (user) {
          User.update(drillUpdate, {
            where: {
              id: user.id
            }
          }).then(function () {
            updateUserVhost(user.id)
            BotServ.say('#doersofstuff', `[API] Drilled status and IRC permissions updated for ${user.email}`)
            resolve({ data: { message: 'Drilled Status Updated' } })
          }).catch(function (error) {
            reject({ error: Errors.throw('server_error', error), meta: {} })
          })
        } else {
          User.findOne({
            where: {},
            include: [
              {
                model: Rat,
                as: 'rats',
                required: true,
                where: {
                  CMDRname: {
                    $iLike: CMDRname
                  }
                }
              }
            ]
          }).then(function (user) {
            if (!user) {
              BotServ.say('#doersofstuff', 'Unable to update drilled status or IRC permissions, could not find user by either CMDR name or email')
              return reject({ error: Errors.throw('not_found', `'issue.fields.${CMDRnameField}`), meta: {} })
            }

            User.update(drillUpdate, {
              where: {
                id: user.id
              }
            }).then(function () {
              updateUserVhost(user.id)
              BotServ.say('#doersofstuff', `[API] Drilled status and IRC permissions updated for ${user.email}`)
              resolve({ data: { message: 'Drilled Status Updated' } })
            }).catch(function (error) {
              reject({ error: Errors.throw('server_error', error), meta: {} })
            })
          }).catch(function (error) {
            reject({ error: Errors.throw('server_error', error), meta: {} })
          })
        }
      }).catch(function (error) {
        reject({ error: Errors.throw('server_error', error), meta: {} })
      })
    })
  }
}

class HTTP {
  static post (request, response, next) {
    Controller.update(request.body, request).then(function (res) {
      response.model.data = res.data
      response.status(200)
      next()
    }, function (error) {
      response.model.errors.push(error.error)
      response.status(error.error.code)
      next()
    })
  }
}

function updateUserVhost (userId) {
  User.findOne({
    where: {
      id: userId
    },
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
        as: 'rats'
      }
    ]
  }).then(function (user) {
    HostServ.updateVirtualHost(user)
  }).catch(function (error) {
    winston.error('Could not get user for userId when updating Vhost', error)
  })
}

module.exports = { Controller, HTTP }