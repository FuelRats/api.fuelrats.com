'use strict'

// hacky way to stop the app ogging
const config = require('../../../config')
config.loggly = false

// gag ssl-root-cas
// gotta be a better way...
let pconsole = {
  log: console.log, // eslint-disable-line no-console
  info: console.info, // eslint-disable-line no-console
  warn: console.warn // eslint-disable-line no-console
}
Object.assign(console, {
  log: () => {},
  info: () => {},
  warn: () => {}
})

require('ssl-root-cas/latest')
Object.assign(console, pconsole)

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
