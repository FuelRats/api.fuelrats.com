'use strict'

// hacky way to stop the app ogging
const config = require('../../../config')
config.loggly = false

let app

async function init () {

  // start the app if not already
  if(!app) {
    app = require('../../../index')
    await new Promise((resolve, reject) => {
      app.on('listening', (err) => {
        if(err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })

  }
}

module.exports.init = init
