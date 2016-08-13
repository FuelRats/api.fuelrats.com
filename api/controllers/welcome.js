'use strict'
let moment = require('moment')
let winston = require('winston')
let User = require('../db').User
let Rat = require('../db').Rat
let Rescue = require('../db').Rescue
let db = require('../db').db

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
      'nicknames',
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
          'codeRed',
          'epic',
          'open',
          'notes',
          'system',
          'successful',
          [db.literal('CASE WHEN "rats.rescues"."firstLimpetId" = "rats"."id" THEN TRUE ELSE FALSE END'), 'isFirstLimpet']
        ]
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
    let user = userInstance.toJSON()
    for (let rat of user.rats) {
      let firstLimpetCount = 0
      let assistCount = 0
      let failureCount = 0

      for (let rescue of rat.rescues) {
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

      rat.firstLimpetCount = firstLimpetCount
      rat.assistCount = assistCount
      rat.failureCount = failureCount
      rat.successRate = ((firstLimpetCount + assistCount) / rat.rescues.length * 100).toFixed(2)
    }
    response.render('welcome.swig', { user: user, userGroupLabel: labels[user.group] })
  }).catch(function (error) {
    console.log(error)
  })
}
