'use strict'
let winston = require('winston')
let ChanServ = require('./ChanServ')
const officialChannels = ['#fuelrats', '#drillrats', '#ratchat']

let client = require('./index').client

class HostServ {
  static set (nickname, host) {
    return new Promise(function (resolve, reject) {
      client.methodCall('command', [['HostServ', 'API', `SETALL ${nickname} ${host}`]], function (error, data) {
        if (error) {
          winston.error(error)
          reject(error)
        } else {
          winston.info(data)
          if (/not registered/.test(data.return) === true) {
            reject(data.return)
          } else {
            resolve(host)
          }
        }
      })
    })
  }

  static updateVirtualHost (user) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        let virtualHost = generateVirtualHost(user)
        winston.info('Generated Vhost: ' + virtualHost)

        if (virtualHost) {
          let hostUpdates = []
          for (let nickname of user.nicknames) {
            hostUpdates.push(HostServ.set(nickname, virtualHost))
          }

          Promise.all(hostUpdates).then(function () {
            for (let channel of officialChannels) {
              ChanServ.sync(channel)
              resolve()
            }
          }).catch(function (errors) {
            for (let channel of officialChannels) {
              ChanServ.sync(channel)
              resolve()
            }
            reject(errors)
          })
        } else {
          reject(null)
        }
      }, 500)
    })
  }
}

function generateVirtualHost (user) {
  let sortedRats = user.rats.sort(function (a, b) {
    return a - b
  })

  let rat
  if (sortedRats.length > 0) {
    rat = IRCSafeName(user.rats[0])
  } else {
    rat = user.id.split('-')[0]
  }

  if (user.group === 'admin') {
    return 'netadmin.fuelrats.com'
  } else if (user.group === 'moderator') {
    return `${rat}.op.fuelrats.com`
  } else if (user.group === 'overseer') {
    return `${rat}.overseer.fuelrats.com`
  } else if (user.drilled === true) {
    return `${rat}.rat.fuelrats.com`
  } else {
    return `${rat}.recruit.fuelrats.com`
  }
}

function IRCSafeName (rat) {
  let ratName = rat.CMDRname
  ratName = ratName.replace(/ /, '')
  ratName = ratName.replace(/[^a-zA-Z0-9\s]/g, '')
  return ratName.toLowerCase()
}

module.exports = HostServ