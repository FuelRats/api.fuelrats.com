'use strict'

let Statistics = require('../classes/Statistics')

exports.get = function (request, response) {
  console.log('leaderboard')
  Statistics.getPopularSystemsCount().then(function () {

  })
  Statistics.getTotalStatistics().then(function () {

  })
  Statistics.getLeaderboardRats().then(function (rats) {
    console.log('render')
    response.render('leaderboard.swig', {CMDRs: rats})
  }, function (error) {

  })
}
