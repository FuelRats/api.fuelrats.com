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
  }).then(function (user) {

    response.render('welcome.swig', { user: user.toJSON(), userGroupLabel: labels[user.group] })
  }).catch(function (error) {
    console.log(error)
  })
}
