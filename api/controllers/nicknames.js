'use strict'
const Permission = require('../permission')
const Errors = require('../errors')
const User = require('../db').User
const db = require('../db').db
const NicknameQuery = require('../Query/NicknameQuery')
const NicknamesPresenter = require('../classes/Presenters').NicknamesPresenter

const NickServ = require('../Anope/NickServ')
const HostServ = require('../Anope/HostServ')

class Nicknames {
  static async info (ctx) {
    if (!ctx.params.nickname || ctx.params.nickname.length === 0) {
      throw Errors.template('missing_required_field', 'nickname')
    }

    let info = await NickServ.info(ctx.params.nickname)
    if (!info) {
      throw Errors.template('not_found')
    }

    return NicknamesPresenter.render(info)
  }

  static async register (ctx) {
    let fields = ['nickname', 'password']
    for (let field of fields) {
      if (!ctx.data[field]) {
        throw Errors.template('missing_required_field', field)
      }
    }

    await NickServ.register(ctx.data.nickname, ctx.data.password, ctx.state.user.data.attributes.email)

    let nicknames = ctx.state.user.data.attributes.nicknames
    nicknames.push(ctx.data.nickname)

    await User.update({ nicknames: db.cast(nicknames, 'citext[]') }, {
      where: { id: ctx.state.user.data.id }
    })

    let user = await User.findOne({
      where: { id: ctx.state.user.data.id }
    })

    await HostServ.updateVirtualHost(user)
    return ctx.data.nickname
  }

  static async connect (ctx) {
    let fields = ['nickname', 'password']

    for (let field of fields) {
      if (!ctx.data[field]) {
        throw Errors.template('missing_required_field', field)
      }
    }

    await NickServ.identify(ctx.data.nickname, ctx.data.password)

    let nicknames = ctx.state.user.data.attributes.nicknames
    nicknames.push(ctx.data.nickname)

    await User.update({ nicknames: db.cast(nicknames, 'citext[]') }, {
      where: { id: ctx.state.user.data.id }
    })

    let user = await User.findOne({
      where: {id: ctx.state.user.data.id}
    })


    await HostServ.updateVirtualHost(user)
    return ctx.data.nickname
  }

  static async search (ctx) {
    if (!ctx.params.nickname) {
      throw Errors.template('missing_required_field', 'nickname')
    }

    let result = await User.findAndCountAll(new NicknameQuery(ctx.params, ctx).toSequelize)
    return NicknamesPresenter.render(result)
  }

  static async delete (ctx) {
    if (!ctx.params.nickname) {
      throw Errors.template('missing_required_field', 'nickname')
    }

    if (ctx.state.user.data.attributes.nicknames.includes(ctx.params.nickname) ||
      Permission.require(['nickname.delete'], ctx.state.user, ctx.state.scope)) {
      await NickServ.drop(ctx.params.nickname)

      let nicknames = ctx.state.user.data.attributes.nicknames
      nicknames.splice(nicknames.indexOf(ctx.params.nickname), 1)

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
