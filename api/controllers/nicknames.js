'use strict'
const Permission = require('../permission')
const Errors = require('../errors')
const User = require('../db').User
const db = require('../db').db
const Rat = require('../db').Rat
const NicknameQuery = require('../Query/NicknameQuery')

const NickServ = require('../Anope/NickServ')
const HostServ = require('../Anope/HostServ')


class Nicknames {
  static info (params, connection) {
    return new Promise(function (resolve, reject) {
      if (!params.nickname || params.nickname.length === 0) {
        console.log('reject')
        return reject(Errors.throw('missing_required_field', 'nickname'))
      }

      NickServ.info(params.nickname).then(function (info) {
        if (!info) {
          console.log('404')
          return reject(Errors.throw('not_found'))
        }

        resolve(new NicknameInfoResult(info, params, connection.user.group).toResponse())
      }).catch(function (error) {
        reject(Errors.throw('server_error', error))
      })
    })
  }

  static register (params, connection, data) {
    return new Promise(function (resolve, reject) {
      let fields = ['nickname', 'password']

      for (let field of fields) {
        if (!data[field]) {
          reject({ meta: {}, error: Errors.throw('missing_required_field', field) })
          return
        }
      }

      NickServ.identify(data.nickname, data.password).then(function () {
        let nicknames = connection.user.nicknames
        nicknames.push(data.nickname)

        User.update({ nicknames: db.cast(nicknames, 'citext[]') }, {
          where: { id: connection.user.id }
        }).then(function () {
          User.findOne({
            where: {id: connection.user.id},
            attributes: {
              include: [
                [db.cast(db.col('nicknames'), 'text[]'), 'nicknames']
              ],
              exclude: [
                'nicknames'
              ]
            },
            include: [
              {
                model: Rat,
                as: 'rats',
                required: false
              }
            ]
          }).then(function (user) {
            HostServ.updateVirtualHost(user).then(function () {
              resolve({meta: {}, data: data.nickname})
            }).then(function (user) {
              HostServ.updateVirtualHost(user).then(function () {
                resolve({ meta: {}, data: data.nickname })
              })
            })
          })
        })
      }).catch(function () {
        reject({ meta: {}, error: Errors.throw('no_permission') })
      })
    })
  }

  static connect (params, connection, data) {
    return new Promise(function (resolve, reject) {
      let fields = ['nickname', 'password']

      for (let field of fields) {
        if (!data[field]) {
          reject({ meta: {}, error: Errors.throw('missing_required_field', field) })
          return
        }
      }

      NickServ.identify(data.nickname, data.password).then(function () {
        let nicknames = connection.user.nicknames
        nicknames.push(data.nickname)

        User.update({ nicknames: db.cast(nicknames, 'citext[]') }, {
          where: { id: connection.user.id }
        }).then(function () {
          User.findOne({
            where: { id: connection.user.id },
            attributes: {
              include: [
                [db.cast(db.col('nicknames'), 'text[]'), 'nicknames']
              ],
              exclude: [
                'nicknames'
              ]
            },
            include: [
              {
                model: Rat,
                as: 'rats',
                required: false
              }
            ]
          }).then(function (user) {
            HostServ.updateVirtualHost(user).then(function () {
              resolve({ meta: {}, data: data.nickname })
            })
          })
        }).catch(function (error) {
          reject({ meta: {}, error: Errors.throw('server_error', error) })
        })
      }).catch(function () {
        reject({ meta: {}, error: Errors.throw('no_permission') })
      })
    })
  }

  static search (params, connection) {
    return new Promise(function (resolve, reject) {
      if (!params.nickname) {
        reject({meta: {}, error: Errors.throw('missing_required_field', 'nickname')})
      }

      User.findAndCountAll(new NicknameQuery(params, connection).toSequelize).then(function (result) {
        let accessToPrivateInfo = Permission.granted(['user.read'], connection.user, connection.scope)
        resolve(new NicknameResult(result, params, accessToPrivateInfo).toResponse())
      })
    })
  }

  static delete (params, connection) {
    return new Promise(function (resolve, reject) {
      if (!params.nickname) {
        reject({ meta: {}, error: Errors.throw('missing_required_field', 'nickname') })
      }

      if (connection.user.nicknames.includes(params.nickname) || connection.user.group === 'admin') {
        NickServ.drop(params.nickname).then(function () {
          let nicknames = connection.user.nicknames
          nicknames.splice(nicknames.indexOf(params.nickname), 1)

          User.update({ nicknames: db.cast(nicknames, 'citext[]') }, {
            where: {
              id: connection.user.id
            }
          }).then(function () {
            resolve()
          })
        }).catch(function (error) {
          reject({ meta: {}, error: Errors.throw('server_error', error) })
        })
      } else {
        reject({ meta: {}, error: Errors.throw('no_permission') })
      }
    })
  }
}

module.exports = Nicknames
