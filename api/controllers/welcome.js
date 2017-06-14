'use strict'
const moment = require('moment')
const winston = require('winston')
const User = require('../db').User
const Rat = require('../db').Rat
const Rescue = require('../db').Rescue
const Epic = require('../db').Epic
const Ship = require('../db').Ship
const Decal = require('../db').Decal
const db = require('../db').db

const labels = {
  'normal': 'default',
  'overseer': 'info',
  'moderator': 'warning',
  'admin': 'danger'
}

exports.get = function (request, response) {
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
      }, {
        required: false,
        model: Ship,
        as: 'ships'
      }]
    }, {
      required: false,
      model: Decal,
      as: 'decal'
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

      let openRescues = []

      for (let rescue of rat.rescues) {
        if (rescue.open === true) {
          openRescues.push(rescue)
          rat.rescues.splice(rat.rescues.indexOf(rescue), 1)
        } else {
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
      rat.openRescues = openRescues
      rat.successRate = ((firstLimpetCount + assistCount) / rat.rescues.length * 100).toFixed(2)
    }
    response.render('welcome.swig', { user: user, userGroupLabel: labels[user.group] })
  }).catch(function (error) {
    console.log(error)
  })
}
