'use strict'

let Rat = require('../models/rat')
let Rescue = require('../models/rescue')

exports.get = function (request, response, next) {
  let operations = []

  operations.push(getOverallRescueCount())
  operations.push(getPopularSystemsCount())
  operations.push(getLeaderboardRats())

  Promise.all(operations).then(function (values) {
    response.model.data = values
    response.status(200)
    next()
  }, function (errors) {
    console.log(errors)
  })
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

let getOverallRescueCount = function () {
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

let getPopularSystemsCount = function () {
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


let getLeaderboardRats = function () {
  return Rat.aggregate([
    {
      $match: {
        rescueCount: {
          $gte: 10
        }
      }
    },
    {
      $project: {
        CMDRname: 1,
        platform: 1,
        rescues: {
          $size: '$rescues'
        }
      }
    },
    {
      $sort: {
        rescues: -1
      }
    }
  ]).exec()
}
