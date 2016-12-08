'use strict'
let moment = require('moment')
let winston = require('winston')
let User = require('../db').User
let Rat = require('../db').Rat
let Rescue = require('../db').Rescue
let Epic = require('../db').Epic
let db = require('../db').db

exports.get = function (request, response, next) {
  User.findOne({
    where: {
      id: request.user.id
    },
    attributes: [
      'id',
      'email',
      [db.cast(db.col('nicknames'), 'text[]'), 'nicknames'],
      'drilled',
      'drilledDispatch',
      'group'
    ],
    include: [{
      model: Rat,
      where: {},
      attributes: [
        'id',
        'CMDRname',
        'platform'
      ],
      required: false,
      as: 'rats',
      include: [{
        required: false,
        model: Rescue,
        as: 'rescues',
        through: {
          attributes: []
        },
        attributes: [
          'id',
          'createdAt',
          'client',
          'codeRed',
          'open',
          'notes',
          'system',
          'successful',
          [db.literal('CASE WHEN "rats.rescues"."firstLimpetId" = "rats"."id" THEN TRUE ELSE FALSE END'), 'isFirstLimpet']
        ],
        include: [{
          required: false,
          model: Epic,
          as: 'epics',
          attributes: [
            'id',
            'createdAt',
            'notes',
            'ratId'
          ]
        }]
      }]
    }],
    order: [
      [
        { model: Rat, as: 'rats' },
        { model: Rescue, as: 'rescues' },
        'createdAt',
        'DESC'
      ]
    ]
  }).then(function (userInstance) {
    if (!userInstance) {
      response.render('errors/404.swig')
    }

    let user = userInstance.toJSON()
    for (let rat of user.rats) {
      let firstLimpetCount = 0
      let assistCount = 0
      let failureCount = 0
      let totalRescues = 0


      for (let rescue of rat.rescues) {
        if (rescue.open === false) {
          totalRescues += 1
          if (rescue.successful === true) {
            if (rescue.isFirstLimpet === true) {
              firstLimpetCount += 1
            } else {
              assistCount += 1
            }
          } else {
            failureCount += 1
          }
        }
      }


      rat.firstLimpetCount = firstLimpetCount
      rat.assistCount = assistCount
      rat.failureCount = failureCount
      rat.totalRescues = totalRescues
      rat.successRate = ((firstLimpetCount + assistCount) / rat.rescues.length * 100).toFixed(2)
      delete rat.rescues
    }
    response.model.data = user
    next()
  }).catch(function (error) {
    response.model.errors.push(error)
    next()
  })
}
