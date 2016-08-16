'use strict'
let _ = require('underscore')
let Errors = require('../errors')
let User = require('../db').User
let Rat = require('../db').Rat


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
        let rats = ratInstances.map(function (ratInstance) {
          let rat = ratInstance.toJSON()
          return rat
        })
        resolve(rats)
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
      response.render('roster.swig', { rats: data })
    }, function (error) {
      console.log(error)
      response.model.errors.push(error.error)
      response.status(error.error.code)
      next()
    })
  }
}

module.exports = { HTTP: HTTP, Controller: Controller }
