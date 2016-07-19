'use strict'
let Rescue = require('../db').Rescue
let Rat = require('../db').Rat
let User = require('../db').User
let db = require('../db').db


class Statistics {
  static getLeaderboardRats () {
    return new Promise(function (resolve, reject) {
      try {
        Rat.findAll({
          where: {},
          include: [{
            model: Rescue,
            attributes: [],
            where: {
              successful: true
            },
            required: true
          }],
          attributes: [
            'id',
            [db.fn('COUNT', 'Rescue.id'), 'rescueCount'],
            [db.fn('bool_or', db.col('epic')), 'epic'],
            [db.fn('bool_or', db.col('codeRed')), 'codeRed'],
            'CMDRname',
            'joined'
          ],
          group: ['Rat.id'],
          order: [[db.fn('COUNT', 'Rescue.id'), 'DESC']]
        }).then(function (ratInstances) {
          let rats = ratInstances.map(function (ratInstance) {
            let rat = ratInstance.toJSON()
            let pips = Math.floor(rat.rescueCount / 100)
            rat.pips = pips > 4 ? 4 : pips
            return rat
          })
          resolve(rats)
        }).catch(function (error) {
          reject()
        })
      } catch(ex) {
        reject()
      }
    })
  }

  static getPopularSystemsCount () {
    return new Promise(function (resolve, reject) {
      Rescue.findAll({
        where: {},
        attributes: [
          'system',
          [db.fn('COUNT', 'system'), 'count']
        ],
        group: ['system'],
        order: [[db.fn('COUNT', 'system'), 'DESC']],
        limit: 50
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
        where: {},
        attributes: [
          [db.fn('date_trunc', 'day', db.col('createdAt')), 'date'],
          [db.fn('SUM', db.cast(db.col('successful'), 'INTEGER')), 'successCount'],
          [db.fn('COUNT', 'id'), 'total']
        ],
        group: [db.fn('date_trunc', 'day', db.col('createdAt'))],
        order: [[db.fn('date_trunc', 'day', db.col('createdAt')), 'DESC']]
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

  static getTotalStatistics2 () {
    return Rescue.aggregate([
      {
        $project: {
          successful: {
            $cond: ['$successful', 1, 0]
          }
        }
      }, {
        $group: {
          _id: null,
          successful: {
            $sum: '$successful'
          },
          total: {
            $sum: 1
          }
        }
      }
    ]).exec()
  }

  static getOverallRescueCount () {
    return new Promise(function (resolve, reject) {
      Rescue.aggregate([
        groupByDateAggregator
      ]).exec().then(function (objs) {
        let organisedCollection = []
        for (let obj of objs) {
          let date = Date.parse(`${obj._id.year}-${obj._id.month}-${obj._id.day}`)
          let days = organisedCollection.filter(function (el) {
            return el.date === date
          })

          let day
          if (days.length === 0) {
            day = { date: date, success: 0, failure: 0 }
          } else {
            day = days[0]
            organisedCollection.splice(organisedCollection.indexOf(day), 1)
          }

          if (obj._id.successful === true) {
            day.success = obj.count
          } else {
            day.failure = obj.count
          }
          organisedCollection.push(day)
        }
        organisedCollection = organisedCollection.sort(function (x, y) {
          return y - x
        })
        resolve(organisedCollection)
      }, function (errors) {
        reject(errors)
      })
    })
  }
}

let groupByDateAggregator = {
  $group: {
    _id: {
      month: {
        $month: '$createdAt'
      },
      day: {
        $dayOfMonth: '$createdAt'
      },
      year: {
        $year: '$createdAt'
      },
      successful: '$successful'
    },
    count: {
      $sum: 1
    }
  }
}

module.exports = Statistics
