'use strict'

require('intl')

let Statistics = require('../classes/Statistics')

exports.get = function (request, response) {
  Statistics.getLeaderboardRats().then(function (rats) {

    Statistics.getOverviewStatistics().then(function (overviewInstance) {
      console.log(overviewInstance)
      try {
        let overview = overviewInstance[0].toJSON()
        overview.failureCount = (overview.rescueCount - overview.successCount).toLocaleString('en-GB', {
          style: 'decimal'
        })
        overview.successRate = (overview.successCount / overview.rescueCount * 100).toFixed(2)
        overview.successCount = overview.successCount.toLocaleString('en-GB', {
          style: 'decimal'
        })
        response.render('leaderboard.swig', {users: rats, overview: overview, southern: request.isSouthernHemisphere})
      } catch (ex) {
        console.log(ex)
      }
    }).catch(function (error) {
      response.model.errors.push(error)
      response.status(500)
    })
  }).catch(function (error) {
    response.model.errors.push(error)
    response.status(500)
  })
}