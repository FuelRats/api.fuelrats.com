'use strict'

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

log4js.configure({
  appenders: {
    console: { type: 'console' },
    slack: {
      type: 'frslack',
      token: 'xoxb-224743461111-RXUqc7ezTmOaxc2pWpLvppBj',
      channel_id: 'development',
      username: 'fuelratsapi'
    },
    alerts: {
      type: 'logLevelFilter',
      appender: 'slack',
      level: 'error'
    },
    loggly: {
      type: 'frloggly',
      token: '1ba2142e-2339-476e-80c3-31eeb2bae1f8',
      subdomain: 'fuelrats',
      tags: ['local-dev', 'nodejs'],
      json: true,
      layout: { type: 'frloggly' }
    }
  },
  categories: {
    default: {
      appenders: [ 'console', 'alerts', 'loggly' ], level: 'info'
    }
  }
})


const logger = log4js.getLogger()
module.exports = logger