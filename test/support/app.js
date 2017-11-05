'use strict'

// hacky way to stop the app logging
const config = require('../../config')
config.loggly = false

let app

exports.init = async function () {

  // start the app if not already
  if (!app) {
    app = require('../../index')
    await new Promise((resolve, reject) => {
      app.on('listening', (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  } 
}

