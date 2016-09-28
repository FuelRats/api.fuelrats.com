'use strict'
let winston = require('winston')

let xmlrpc = require('homematic-xmlrpc')
let sslRootCAs = require('ssl-root-cas/latest')
  .addFile(__dirname + '/../ca/lets-encrypt-x1-cross-signed.pem')
  .addFile(__dirname + '/../ca/lets-encrypt-x2-cross-signed.pem')
  .addFile(__dirname + '/../ca/lets-encrypt-x3-cross-signed.pem')
  .addFile(__dirname + '/../ca/lets-encrypt-x4-cross-signed.pem')
sslRootCAs.inject()

const client = xmlrpc.createSecureClient('https://irc.eu.fuelrats.com:6080/xmlrpc')
const officialChannels = ['#fuelrats', '#drillrats', '#ratchat']

class Anope {
  static authenticate (nickname, password) {
    return new Promise(function (resolve, reject) {
      client.methodCall('checkAuthentication', [[nickname, password]], function (error, data) {
        if (error) {
          winston.error(error)
          reject(error)
        } else {
          winston.info(data)
          if (data.result === 'Success' && data.account != null) {
            resolve(data.account)
          } else {
            reject(data)
          }
        }
      })
    })
  }

  static register (nickname, password, email) {
    return new Promise(function (resolve, reject) {
      client.methodCall('command', [['NickServ', nickname, `REGISTER ${password} ${email}`]], function (error, data) {
        if (error) {
          winston.error(error)
          reject(error)
        } else {
          winston.info(data)
          if (/Nickname .* registered/.test(data.return) === true) {
            resolve(nickname)
          } else {
            reject(data.return)
          }
        }
      })
    })
  }

  static groupList (account) {
    return new Promise(function (resolve, reject) {
      client.methodCall('command', [['NickServ', account, `GLIST ${account}`]], function (error, data) {
        if (error) {
          winston.error(error)
          reject(error)
        } else {
          winston.info(data)
          if (data.return.includes('Password authentication required')) {
            reject(data.return)
          } else {
            // Split into array by line breaks
            let nicknames = data.return.split('#xA;')

            // Remove column headers and footer
            nicknames = nicknames.slice(2, nicknames.length - 2)

            // Retrieve only the actual nickname from each nickname line
            nicknames = nicknames.map(function (nickname) {
              return nickname.split(' ')[0]
            })
            resolve (nicknames)
          }
        }
      })
    })
  }

  static drop (nickname) {
    return new Promise(function (resolve, reject) {
      client.methodCall('command', [['NickServ', 'API', `DROP ${nickname}`]], function (error, data) {
        if (error) {
          winston.error(error)
          reject(error)
        } else {
          winston.info(data)
          if (data.return.includes('has been dropped')) {
            resolve(nickname)
          } else {
            reject(data.return)
          }
        }
      })
    })
  }

  static info (nickname) {
    return new Promise(function (resolve, reject) {
      client.methodCall('command', [['NickServ', nickname, `INFO ${nickname}`]], function (error, data) {
        if (error) {
          winston.error(error)
          reject(error)
        } else {
          winston.info(data)
          if (data.return.includes('isn&#39;t registered')) {
            resolve(null)
          } else {
            resolve(new IRCUserInfo(data.return.split('#xA;')))
          }
        }
      })
    })
  }

  static confirm (nickname) {
    return new Promise(function (resolve, reject) {
      client.methodCall('command', [['NickServ', 'API', `CONFIRM ${nickname}`]], function (error, data) {
        if (error) {
          winston.error(error)
          reject(error)
        } else {
          winston.info(data)
          if (data.return.includes('has been confirmed')) {
            resolve(nickname)
          } else {
            reject(data.return)
          }
        }
      })
    })
  }

  static setVirtualHost (nickname, host) {
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
            hostUpdates.push(Anope.setVirtualHost(nickname, virtualHost))
          }

          Promise.all(hostUpdates).then(function () {
            for (let channel of officialChannels) {
              Anope.syncChannel(channel)
            }
          }).catch(function (errors) {
            reject(errors)
          })
        } else {
          reject(null)
        }
      }, 500)
    })
  }

  static syncChannel (channel) {
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
  ratName = ratName.replace(/[^a-zA-Z0-9\s]/g, '')
  return ratName.toLowerCase()
}

class IRCUserInfo {
  constructor (info) {
    for (let line of info) {
      // Trim spaces from line and remove superflous & at the end
      line = line.trim().replace(/\&/g, '')
      let components = line.split(' ')

      if (components[1] === 'is' && components[2] === 'a') {
        // User privilege / ircop line
        this.privilege = components.slice(3, components.length).join(' ')
      } else if (components[1] === 'is') {
        // Nickname and real name line
        this.nickname = components[0]
        this.realname = components.slice(2, components.length).join(' ')
      } else {
        switch (components[0]) {
          case 'Email':
            // Email line
            this.email = components[2]
            break

          case 'Online':
            // Hostmask line
            if (this.hostmask) {
              this.vhost = components[2]
            } else {
              this.hostmask = components[2]
            }
            break

          case 'Registered:':
            // Registered date line
            this.registered = Date.parse(components.slice(1, 5).join(' '))
            break

          case 'Expires:':
            // Expire date line
            this.expires = Date.parse(components.slice(1, 5).join(' '))
            break

          case 'Options:':
            // User flags line
            this.options = []
            for (let option of components.slice(1, components.length - 1)) {
              if (option.endsWith(',')) {
                this.options.push(option.substring(0, option.length - 1))
              } else {
                this.options.push(option)
              }
            }
            break
        }
      }
    }
  }
}

module.exports = Anope
