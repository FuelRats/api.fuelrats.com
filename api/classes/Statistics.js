'use strict'
let Rescue = require('../db').Rescue
let Rat = require('../db').Rat
let User = require('../db').User
let db = require('../db').db
let Epic = require('../db').Epic

const notAvailableDummyId = '6ebbe087-7a92-4875-bb68-226db873d3f7'


class Statistics {
  static getOverviewStatistics () {
    return Rescue.findAll({
      where: {
        open: false,
        data: {
          markedForDeletion: {
            marked: {
              $ne: true
            }
          }
        },
        $and: [
          db.literal(`"firstLimpetId" IS DISTINCT FROM '${notAvailableDummyId}'`)
        ]
      },
      attributes: [
        [db.fn('COUNT', 'Rescue.id'), 'rescueCount'],
        [db.fn('SUM', db.cast(db.col('successful'), 'INTEGER')), 'successCount']
      ]
    })
  }

  static getLeaderboardRats () {
    return new Promise(function (resolve, reject) {
      try {
        Rat.findAll({
          raw: true,
          where: {},
          include: [{
            model: Rescue,
            as: 'firstLimpet',
            attributes: [],
            where: {
              successful: true,
              $and: [
                db.literal(`"firstLimpetId" IS DISTINCT FROM '${notAvailableDummyId}'`)
              ]
            },
            required: true
          }, {
            model: User,
            as: 'user',
            attributes: [],
            required: false
          }],
          attributes: [
            [db.fn('COUNT', 'Rescue.id'), 'rescueCount'],
            [db.fn('min', db.col('joined')), 'joined'],
            [db.literal('array_agg(DISTINCT "CMDRname")'), 'rats'],
            [db.fn('bool_or', db.col('codeRed')), 'codeRed'],
            [db.fn('bool_or', db.col('drilledDispatch')), 'drilledDispatch']
          ],
          group: [db.literal('CASE WHEN "Rat"."UserId" IS NULL THEN "Rat"."id" ELSE "Rat"."UserId" END')],
          order: [[db.fn('COUNT', 'Rescue.id'), 'DESC']]
        }).then(function (rats) {
          rats = rats.map(function (rat) {
            if (rat.CMDRname === 'N/A') {
              return null
            }
            let pips = Math.floor(rat.rescueCount / 100)
            rat.pips = pips > 4 ? 4 : pips
            return rat
          })
          resolve(rats)
        }).catch(function (error) {
          reject(error)
        })
      } catch(ex) {
        reject(ex)
      }
    })
  }

  static getPopularSystemsCount () {
    return new Promise(function (resolve, reject) {
      Rescue.findAll({
        where: {
          firstLimpetId: {
            $ne: notAvailableDummyId
          }
        },
        attributes: [
          'system',
          [db.fn('COUNT', 'system'), 'count']
        ],
        group: ['system'],
        order: [[db.fn('COUNT', 'system'), 'DESC']],
        limit: 100
      }).then(function (systemInstances) {
        let systems = systemInstances.map(function (systemInstance) {
          let system = systemInstance.toJSON()
          return system
        })
        resolve(systems)
      })
    }).catch(function (error) {
    })
  }

  static getTotalStatistics () {
    return new Promise(function (resolve, reject) {
      Rescue.findAll({
        where: {
          open: false,
          $and: [
            db.literal(`"firstLimpetId" IS DISTINCT FROM '${notAvailableDummyId}'`)
          ]
        },
        attributes: [
          [db.fn('date_trunc', 'day', db.col('createdAt')), 'date'],
          [db.fn('SUM', db.cast(db.col('successful'), 'INTEGER')), 'successCount'],
          [db.fn('COUNT', 'id'), 'total']
        ],
        group: [db.fn('date_trunc', 'day', db.col('createdAt'))],
        order: [[db.fn('date_trunc', 'day', db.col('createdAt')), 'ASC']]
      }).then(function (rescueDaysInstances) {
        let rescueDays = rescueDaysInstances.map(function (rescueDaysInstance) {
          let rescueDay = rescueDaysInstance.toJSON()
          return rescueDay
        })
        resolve(rescueDays)
      }).catch(function (error) {
      })
    })
  }
}

module.exports = Statistics
