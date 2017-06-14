'use strict'
const winston = require('winston')
const client = require('./index').client

class ChanServ {
  static sync (channel) {
    return new Promise(function (resolve, reject) {
      client.methodCall('command', [['ChanServ', 'API', `SYNC ${channel}`]], function (error, data) {
        if (error) {
          winston.error(error)
          reject(error)
        } else {
          winston.info(data)
          if (/isn't registered/.test(data.return) === true) {
            reject(data.return)
          } else {
            resolve()
          }
        }
      })
    })
  }
}


module.exports = ChanServ