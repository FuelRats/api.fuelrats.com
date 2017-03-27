'use strict'

let Statistics = require('../classes/Statistics')
let winston = require('winston')

exports.get = function (request, response, next) {
  let operations = []



  operations.push(Statistics.getPopularSystemsCount())
  operations.push(Statistics.getTotalStatistics())
  operations.push(Statistics.getOverviewStatistics())
  operations.push(Statistics.getLeaderboardRats())

  Promise.all(operations).then(function (values) {
    response.model.data = values
    response.status(200)
    next()
  }, function (errors) {
    winston.error(errors)
  })
}
