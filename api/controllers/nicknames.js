'use strict'
const Permission = require('../permission')
const Error = require('../errors')
const User = require('../db').User
const db = require('../db').db
const NicknameQuery = require('../Query/NicknameQuery')
const NicknamesPresenter = require('../classes/Presenters').NicknamesPresenter

const NickServ = require('../Anope/NickServ')
const HostServ = require('../Anope/HostServ')

class Nicknames {
  static async info (ctx) {
    if (!ctx.params.nickname || ctx.params.nickname.length === 0) {
      throw Error.template('missing_required_field', 'nickname')
    }

    let info = await NickServ.info(ctx.params.nickname)
    if (!info) {
      throw Error.template('not_found')
    }

    return NicknamesPresenter.render(info)
  }

  static async register (ctx) {
    if (Permission.isAdmin(ctx.state.user)) {
      throw Error.template('operation_failed', 'Admin nicknames cannot be registered')
    }

    let fields = ['nickname', 'password']
    for (let field of fields) {
      if (!ctx.data[field]) {
        throw Error.template('missing_required_field', field)
      }
    }

    let nicknames = ctx.state.user.data.attributes.nicknames
    if (nicknames.includes(ctx.data.nickname)) {
      throw Error.template('already_exists', 'Nickname is already registered')
    }

    if (nicknames.length > 0) {
      await NickServ.group(ctx.data.nickname, nicknames[0], ctx.data.password)
    } else {
      await NickServ.register(ctx.data.nickname, ctx.data.password, ctx.state.user.data.attributes.email)
      await NickServ.confirm(ctx.data.nickname)
    }

    nicknames = await NickServ.list(ctx.data.nickname)

    await User.update({ nicknames: db.cast(nicknames, 'citext[]') }, {
      where: { id: ctx.state.user.data.id }
    })

    await HostServ.update(ctx.state.user)
    return true
  }

  static async connect (ctx) {
    let fields = ['nickname', 'password']

    for (let field of fields) {
      if (!ctx.data[field]) {
        throw Error.template('missing_required_field', field)
      }
    }

    let nicknames = ctx.state.user.data.attributes.nicknames
    if (nicknames.includes(ctx.data.nickname)) {
      throw Error.template('already_exists', 'Nickname is already registered to you')
    }

    await NickServ.identify(ctx.data.nickname, ctx.data.password)
    if (nicknames.length > 0) {
      await NickServ.group(ctx.data.nickname, nicknames[0], ctx.data.password)
    }

    nicknames = await NickServ.list(ctx.data.nickname)

    await User.update({ nicknames: db.cast(nicknames, 'citext[]') }, {
      where: { id: ctx.state.user.data.id }
    })


    await HostServ.update(ctx.state.user)
    return true
  }

  static async search (ctx) {
    if (!ctx.params.nickname) {
      throw Error.template('missing_required_field', 'nickname')
    }

    let result = await User.scope('public').findAndCountAll(new NicknameQuery(ctx.params, ctx).toSequelize)
    return NicknamesPresenter.render(result)
  }

  static async delete (ctx) {
    if (!ctx.params.nickname) {
      throw Error.template('missing_required_field', 'nickname')
    }

    if (ctx.state.user.data.attributes.nicknames.includes(ctx.params.nickname) ||
      Permission.require(['nickname.delete'], ctx.state.user, ctx.state.scope)) {
      await NickServ.drop(ctx.params.nickname)

      let nicknames = await NickServ.list(ctx.state.user.data.attributes.nicknames[0])

      await User.update({
        nicknames: db.cast(nicknames, 'citext[]')
      }, {
        where: {
          id: ctx.state.user.data.id
        }
      })

      return true
    }
  }
}
module.exports = Nicknames
