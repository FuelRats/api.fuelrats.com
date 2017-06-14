'use strict'

const _ = require('underscore')
const db = require('../db').db
const Rat = require('../db').Rat
const Rescue = require('../db').Rescue
const Epic = require('../db').Epic
const API = require('../classes/API')
const RescueQuery = require('../Query/RescueQuery')
const RescueResult = require('../Results/rescue')

const Error = require('../errors')
const Permission = require('../permission')
const BotServ = require('../Anope/BotServ')
const Statistics = require('../classes/Statistics')

class Rescues {
  static async search (params, connection) {
    let result = await Rescue.findAndCountAll(new RescueQuery(params, connection).toSequelize)
    return new RescueResult(result, params).toResponse()
  }

  static async findById (params, connection) {
    if (params.id) {
      let result = await Rescue.findAndCountAll(new RescueQuery({ id: params.id }, connection).toSequelize)
      return new RescueResult(result, params).toResponse()
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static async create (params, connection, data) {
    let rescue = await Rescue.create(data)
    if (!rescue) {
      throw Error.template('operation_failed')
    }
    return new RescueResult(rescue, params).toResponse()
  }

  static async update (params, connection, data) {
    if (params.id) {
      let rescue = await Rescue.findOne({
        where: {
          id: params.id
        }
      })

      if (!rescue) {
        throw Error.template('not_found', params.id)
      }

      let permission = getRescuePermissionType(rescue, connection.user)
      if (Permission.require(permission, connection.user, connection.scope)) {
        let rescue = await Rescue.update(data, {
          where: {
            id: params.id
          }
        })

        if (!rescue) {
          throw Error.template('operation_failed')
        }

        let result = Rescue.findAndCountAll(new RescueQuery({id: params.id}, connection).toSequelize)
        return new RescueResult(result, params).toResponse()
      }
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static async delete (params) {
    if (params.id) {
      let rescue = await Rescue.findOne({
        where: {
          id: params.id
        }
      })

      if (!rescue) {
        throw Error.template('not_found', params.id)
      }

      rescue.destroy()
      return true
    }
  }

  static async assign (params, connection, data) {
    if (params.id) {
      let rescue = await Rescue.findOne({
        where: {
          id: params.id
        }
      })

      if (!rescue) {
        throw Error.template('not_found', params.id)
      }

      let permission = getRescuePermissionType(rescue, connection.user)
      if (Permission.require(permission, connection.user, connection.scope)) {
        let rats = []
        for (let rat of data) {
          rats.push(rescue.addRat(rat))
        }

        await Promise.all(rats)
        let result = await Rescue.findAndCountAll(new RescueQuery({ id: params.id }, connection).toSequelize)
        return new RescueResult(result, params).toResponse()
      }
    }
  }

  static async unassign (params, connection, data) {
    if (params.id) {
      let rescue = await Rescue.findOne({
        where: {
          id: params.id
        }
      })

      if (!rescue) {
        throw Error.template('not_found', params.id)
      }

      let permission = getRescuePermissionType(rescue, connection.user)
      if (Permission.require(permission, connection.user, connection.scope)) {
        let rats = []
        for (let rat of data) {
          rats.push(rescue.removeRat(rat))
        }

        await Promise.all(rats)
        let result = await Rescue.findAndCountAll(new RescueQuery({ id: params.id }, connection).toSequelize)
        return new RescueResult(result, params).toResponse()
      }
    }
  }

  static async addquote (params, connection, data) {
    if (params.id) {
      let rescue = await Rescue.findOne({
        where: {
          id: params.id
        }
      })

      if (!rescue) {
        throw Error.template('not_found', params.id)
      }

      let permission = getRescuePermissionType(rescue, connection.user)
      if (Permission.require(permission, connection.user, connection.scope)) {
        await Rescue.update({
          quotes: rescue.quotes.concat(data)
        }, {
          where: {
            id: params.id
          }
        })

        let result = await Rescue.findAndCountAll(new RescueQuery({ id: params.id }, connection).toSequelize)
        return new RescueResult(result, params).toResponse()
      }
    }
  }
}

const selfWriteAllowedPermissions = ['rescue.write.me', 'rescue.write']

function getRescuePermissionType (rescue, user) {
  if (user) {
    for (let CMDR of user.CMDRs) {
      if (rescue.rats.includes(CMDR) || rescue.firstLimpetId === CMDR) {
        return selfWriteAllowedPermissions
      }
    }
  }
  return ['rescue.write']
}

module.exports = Rescues