'use strict'

let config = require('../config')

const log4js = require('log4js')

log4js.addLayout('frloggly', function (config) {
  return function (logEvent) {
    let obj =  {
      msg: logEvent.data[0],
      pid: logEvent.pid
    }

    if (logEvent.data[1]) {
      for (let key of Object.keys(logEvent.data[1])) {
        let value = logEvent.data[1][key]
        if (Array.isArray(value)) {
          obj[key] = value.join(', ')
        } else if (typeof value === 'object') {
          obj[key] = JSON.stringify(value)
        } else {
          obj[key] = value
        }
      }
    }
    return obj
  }
})

if (config.loggly) {
  log4js.configure(config.loggly)
}


const logger = log4js.getLogger()
module.exports = logger