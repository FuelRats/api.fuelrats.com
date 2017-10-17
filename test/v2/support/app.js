'use strict'

// hacky way to stop the app logging
const config = require('../../../config')
config.loggly = false

// gag ssl-root-cas
const mock = require('mock-require')
const cas = {
  addFile: function () { return cas },
  inject: function () { return cas }
}
mock('ssl-root-cas/latest', cas)

let app

exports.init = async function () {

  // start the app if not already
  if (!app) {
    app = require('../../../index')
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

