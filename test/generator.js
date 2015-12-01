module.exports = {
  randomRescue: function () {
    randomName = ( Date.now() - parseInt( ( Math.random() * Math.random() ) * 1000000 ) ).toString( 36 );

    return {
      CMDRname: 'CMDR ' + randomName,
      codeRed: !!Math.round( Math.random() ), // Randomly decide if this is a code red
      nearestSystem: 'Eravate',
      nickname: randomName,
      platform: Math.round( Math.random() ) ? 'PC' : 'XB' // Randomly decide if the client is PC or Xbox
    };
  },

  randomRat: function () {
    randomName = ( Date.now() - parseInt( ( Math.random() * Math.random() ) * 1000000 ) ).toString( 36 );

    return {
      CMDRname: 'CMDR Test Rat ' + randomName,
      gamertag: 'Gamertag Test Rat ' + randomName,
      drilled: !!Math.round( Math.random() ), // Randomly decide if this rat has been drilled
      nickname: randomName,
    };
  }
}
