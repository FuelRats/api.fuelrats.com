'use strict'

// just have log4js only report to the console
const config = require('../../config')
config.loggly.categories.default.appenders = ['console']

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

