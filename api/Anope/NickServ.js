'use strict'
const winston = require('winston')

const client = require('./index').client

class NickServ {
  static identify (nickname, password) {
    return new Promise(function (resolve, reject) {
      client.methodCall('checkAuthentication', [[nickname, password]], function (error, data) {
        if (error) {
          winston.error(error)
          reject(error)
        } else {
          winston.info(data)
          if (data.result === 'Success' && data.account !== null) {
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
          if (data && /Nickname .* registered/.test(data.return) === true) {
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

module.exports = NickServ