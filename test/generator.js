'use strict'

module.exports = {
  randomRescue: function () {
    let randomName = (Date.now() - parseInt((Math.random() * Math.random()) * 1000000)).toString(36)

    return {
      active: true,
      client: randomName,
      codeRed: !!Math.round(Math.random()),
      data: { foo: ['test'] },
      epic: false,
      open: true,
      notes: 'test',
      platform: Math.round(Math.random()) ? 'pc' : 'xb', // Randomly decide if the client is PC or Xbox
      quotes: ['test'],
      successful: !!Math.round(Math.random()),
      system: 'Eravate',
      title: 'Operation Unit Test',
      unidentifiedRats: ['TestRat']
    }
  },

  randomRat: function () {
    let randomName = (Date.now() - parseInt((Math.random() * Math.random()) * 1000000)).toString(36)

    return {
      CMDRname: 'Test Rat ' + randomName,
      data: { foo: ['test'] },
      platform: Math.round(Math.random()) ? 'pc' : 'xb' // Randomly decide if the rat is PC or Xbox
    }
  }
}
