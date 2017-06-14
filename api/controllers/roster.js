'use strict'
const _ = require('underscore')
const Errors = require('../errors')
const User = require('../db').User
const Rat = require('../db').Rat


class Controller {
  static roster () {
    return new Promise(function (resolve, reject) {
      Rat.findAll({
        where: {},
        include: [{
          model: User,
          as: 'user',
          attributes: [
            'id',
            'drilled',
            'drilledDispatch',
            'group'
          ],
          required: false,
          where: {}
        }],
        attributes: [
          'id',
          'CMDRname',
          'platform',
          'joined'
        ],
        order: [['joined', 'DESC']]
      }).then(function (ratInstances) {
        let overseers = []

        let rats = ratInstances.map(function (ratInstance) {
          let rat = ratInstance.toJSON()
          if (rat.CMDRname === 'N/A') {
            return null
          }

          if (rat.user && (rat.user.group === 'overseer' || rat.user.group === 'moderator')) {
            overseers.push(rat)
          }
          return rat
        })

        overseers.sort(function (a, b) {
          a.CMDRname.localeCompare(b.CMDRname)
        })
        resolve({ rats: rats, overseers: overseers })
      }).catch(function (error) {
        reject(error)
      })
    })
  }
}

class HTTP {
  static get (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)

    Controller.roster(request.body, request, request.query).then(function (data) {
      response.render('roster.swig', data)
    }, function (error) {
      response.model.errors.push(error.error)
      response.status(error.error.code)
      next()
    })
  }
}

module.exports = { HTTP: HTTP, Controller: Controller }
