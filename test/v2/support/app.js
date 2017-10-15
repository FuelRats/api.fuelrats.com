'use strict'

const { pick } = require('underscore')

// hacky way to stop the app logging
const config = require('../../../config')
config.loggly = false

// gag ssl-root-cas
// gotta be a better way...
const cm = ['log', 'info', 'warn', 'error']
const pc = pick(console, cm)
cm.reduce((n, v) => { n[v] = () => {}; return n }, console)
require('ssl-root-cas/latest')
Object.assign(console, pc)

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
