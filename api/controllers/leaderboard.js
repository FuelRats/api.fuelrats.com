'use strict'

let Statistics = require('../classes/Statistics')

exports.get = function (request, response) {
  Statistics.getLeaderboardRats().then(function (rats) {
    response.render('leaderboard.swig', {CMDRs: rats})
  }, function (error) {

  })
}
