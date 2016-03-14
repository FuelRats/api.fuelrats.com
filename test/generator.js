'use strict'
module.exports = {
  randomRescue: function () {
    let randomName = (Date.now() - parseInt((Math.random() * Math.random()) * 1000000)).toString(36)

    return {
      client: {
        CMDRname: randomName,
        nickname: randomName
      },
      codeRed: !!Math.round(Math.random()), // Randomly decide if this is a code red
      system: 'Eravate',
      platform: Math.round(Math.random()) ? 'pc' : 'xb' // Randomly decide if the client is PC or Xbox
    }
  },

  randomRat: function () {
    var randomName

    randomName = (Date.now() - parseInt((Math.random() * Math.random()) * 1000000)).toString(36)

    return {
      CMDRname: 'CMDR Test Rat ' + randomName,
      gamertag: 'Gamertag Test Rat ' + randomName,
      drilled: !!Math.round(Math.random()), // Randomly decide if this rat has been drilled
      nickname: randomName
    }
  }
}
