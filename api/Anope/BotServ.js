'use strict'
let winston = require('winston')
let client = require('./index').client

class ChanServ {
  static say (channel, message) {
    return new Promise(function (resolve, reject) {
      client.methodCall('command', [['BotServ', 'API', `SAY ${channel} ${message}`]], function (error, data) {
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


  static act (channel, message) {
    return new Promise(function (resolve, reject) {
      client.methodCall('command', [['BotServ', 'API', `SAY ${channel} ${message}`]], function (error, data) {
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