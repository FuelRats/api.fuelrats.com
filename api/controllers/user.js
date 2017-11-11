'use strict'

const { User } = require('../db')

const Error = require('../errors')
const Permission = require('../permission')
const UserQuery = require('../Query/UserQuery')
const HostServ = require('../Anope/HostServ')
const bcrypt = require('bcrypt')
const { UsersPresenter } = require('../classes/Presenters')
const gm = require('gm')

const BCRYPT_ROUNDS_COUNT = 12
const PROFILE_IMAGE_MIN = 64
const PROFILE_IMAGE_MAX = 100

class Users {
  static async search (ctx) {
    let userQuery = new UserQuery(ctx.query, ctx)
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
    return UsersPresenter.render(result.rows, ctx.meta(result, userQuery))
  }

  static async findById (ctx) {
    if (ctx.params.id) {
      let userQuery = new UserQuery({ id: ctx.params.id }, ctx)
      let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)

      if (result.rows.length === 0 || hasValidPermissionsForUser(ctx, result.rows[0], 'read')) {
        return UsersPresenter.render(result.rows, ctx.meta(result, userQuery))
      }

      throw Error.template('no_permission', 'user.read')
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static async image (ctx, next) {
    let user = await User.scope('image').findById(ctx.params.id)
    ctx.type = 'image/jpeg'
    ctx.body = user.image
    next()
  }


  static async create (ctx) {
    let result = await User.create(ctx.data)
    if (!result) {
      throw Error.template('operation_failed')
    }

    ctx.response.status = 201

    return UsersPresenter.render(result, ctx.meta(result))
  }

  static async update (ctx) {
    if (ctx.params.id) {
      let user = await User.findOne({
        where: {
          id: ctx.params.id
        }
      })

      if (!user) {
        throw Error.template('not_found', ctx.params.id)
      }

      if (hasValidPermissionsForUser(ctx, user, 'write')) {
        let rescue = await User.update(ctx.data, {
          where: {
            id: ctx.params.id
          }
        })

        if (!rescue) {
          throw Error.template('operation_failed')
        }

        let userQuery = new UserQuery({id: ctx.params.id}, ctx)
        let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
        return UsersPresenter.render(result.rows, ctx.meta(result, userQuery))
      }
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static async setimage (ctx) {
    let user = await User.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!user) {
      throw Error.template('not_found', ctx.params.id)
    }

    if (hasValidPermissionsForUser(ctx, user, 'write')) {
      let imageData = ctx.req._readableState.buffer.head.data

      let formattedImageData = await formatImage(imageData)
      await User.update({
        image: formattedImageData
      }, {
        where: {id: ctx.params.id}
      })

      let userQuery = new UserQuery({id: ctx.params.id}, ctx)
      let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
      return UsersPresenter.render(result.rows, ctx.meta(result, userQuery))
    } else {
      throw Error.template('no_permission', 'user.write')
    }
  }

  static async setpassword (ctx) {
    let user = await User.findOne({
      where: {
        id: ctx.state.user.data.id
      }
    })



    let validatePassword = await bcrypt.compare(ctx.data.password, user.password)
    if (!validatePassword) {
      throw Error.template('no_permission', 'Password is incorrect')
    }

    let newPassword = await bcrypt.hash(ctx.data.new, BCRYPT_ROUNDS_COUNT)
    await User.update({
      password: newPassword
    }, {
      where: { id: user.id }
    })

    let userQuery = new UserQuery({id: ctx.state.user.data.id}, ctx)
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
    return UsersPresenter.render(result.rows, ctx.meta(result, userQuery))
  }

  static async delete (ctx) {
    if (ctx.params.id) {
      let rescue = await User.findOne({
        where: {
          id: ctx.params.id
        }
      })

      if (!rescue) {
        throw Error.template('not_found', ctx.params.id)
      }

      rescue.destroy()

      ctx.status = 204
      return true
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static async updatevirtualhost (ctx) {
    if (ctx.params.id) {
      let userQuery = new UserQuery({ id: ctx.params.id }, ctx)
      let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
      if (result) {
        return HostServ.update(result)
      }
      throw Error.template('not_found', 'id')
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }
}

/**
 * Check whether the user has permissions to perform the required action to this user
 * @param ctx the request object to validate
 * @param user the user to check
 * @param action the action to perform
 * @returns {boolean} Whether the user has permission to perform the required action
 */
function hasValidPermissionsForUser (ctx, user, action = 'read') {
  let permissions = [`user.${action}`]
  if (user.id === ctx.state.user.data.id) {
    permissions.push(`user.${action}.me`)
  }

  return Permission.require(permissions, ctx.state.user, ctx.state.scope)
}

/**
 * Resize the image to the required format for fuelrats.com profile images
 * @param imageData Original image data
 * @returns {Promise} A resized image
 */
function formatImage (imageData) {
  return new Promise(function (resolve, reject) {
    gm(imageData).identify((err, data) => {
      if (err || data.format !== 'JPEG') {
        reject(Error.template('invalid_image_format', 'Expected image/jpeg'))
      }

      if (data.size.width < PROFILE_IMAGE_MIN || data.size.height < PROFILE_IMAGE_MIN) {
        reject(Error.template('invalid_image_format', 'Image must be at least 64x64'))
      }

      gm(imageData).resize(PROFILE_IMAGE_MAX, PROFILE_IMAGE_MAX, '!').toBuffer('JPG', (err, buffer) => {
        if (err) {
          reject(Error.template('invalid_image_format', 'Your image could not be saved in a valid format'))
        }
        resolve(buffer)
      })
    })
  })
}

module.exports = Users
