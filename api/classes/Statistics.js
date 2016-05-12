'use strict'
let Rat = require('../models/rat')
let Rescue = require('../models/rescue')

class Statistics {
  static getLeaderboardRats (from) {
    from = from || 0
    return Rat.aggregate([
      {
        $match: {
          successfulRescueCount: {
            $gte: 1
          }
        }
      },
      {
        $project: {
          CMDRname: 1,
          failedAssistCount: 1,
          failedRescueCount: 1,
          platform: 1,
          successfulAssistCount: 1,
          successfulRescueCount: 1
        }
      },
      {
        $sort: {
          successfulRescueCount: -1
        }
      },
      {
        $skip: from
      },
      {
        $limit: 50
      }
    ]).exec()
  }

  static getPopularSystemsCount () {
    return Rescue.aggregate([
      {
        $group: {
          _id: '$system',
          count: {
            $sum: 1
          }
        }
      },
      {
        $match: {
          count: {
            $gte: 10
          }
        }
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          count: 1
        }
      }
    ]).exec()
  }

  static getTotalStatistics () {
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
