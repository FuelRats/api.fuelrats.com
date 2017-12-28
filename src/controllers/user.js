

import { User } from '../db'

import UserQuery from '../Query/UserQuery'
import HostServ from '../Anope/HostServ'
import bcrypt from 'bcrypt'
import gm from 'gm'
import APIEndpoint from '../APIEndpoint'
import Rats from './rat'
import Groups from './group'
const {
  NotFoundAPIError,
  UnauthorizedAPIError,
  UnsupportedMediaAPIError,
  BadRequestAPIError
} = require('../APIError')

const BCRYPT_ROUNDS_COUNT = 12
const PROFILE_IMAGE_MIN = 64
const PROFILE_IMAGE_MAX = 100

class Users extends APIEndpoint {
  async search (ctx) {
    let userQuery = new UserQuery(ctx.query, ctx)
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
    return Users.presenter.render(result.rows, ctx.meta(result, userQuery))
  }

  async findById (ctx) {
    let userQuery = new UserQuery({ id: ctx.params.id }, ctx)
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)

    return Users.presenter.render(result.rows, ctx.meta(result, userQuery))
  }

  async image (ctx, next) {
    let user = await User.scope('image').findById(ctx.params.id)
    ctx.type = 'image/jpeg'
    ctx.body = user.image
    next()
  }


  async create (ctx) {
    let result = await User.create(ctx.data)
    ctx.response.status = 201

    return Users.presenter.render(result, ctx.meta(result))
  }

  async update (ctx) {
    this.requireWritePermission(ctx, ctx.data)

    let user = await User.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission(ctx, user)

    await User.update(ctx.data, {
      where: {
        id: ctx.params.id
      }
    })

    let userQuery = new UserQuery({id: ctx.params.id}, ctx)
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
    return Users.presenter.render(result.rows, ctx.meta(result, userQuery))
  }

  async setimage (ctx) {
    let user = await User.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission(ctx, user)

    let imageData = ctx.req._readableState.buffer.head.data

    let formattedImageData = await formatImage(imageData)
    await User.update({
      image: formattedImageData
    }, {
      where: {id: ctx.params.id}
    })

    let userQuery = new UserQuery({id: ctx.params.id}, ctx)
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
    return Users.presenter.render(result.rows, ctx.meta(result, userQuery))
  }

  async setpassword (ctx) {
    let user = await User.findOne({
      where: {
        id: ctx.state.user.data.id
      }
    })

    let validatePassword = await bcrypt.compare(ctx.data.password, user.password)
    if (!validatePassword) {
      throw new UnauthorizedAPIError({ pointer: '/data/attributes/password' })
    }

    let newPassword = await bcrypt.hash(ctx.data.new, BCRYPT_ROUNDS_COUNT)
    await User.update({
      password: newPassword
    }, {
      where: { id: user.id }
    })

    let userQuery = new UserQuery({id: ctx.state.user.data.id}, ctx)
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
    return Users.presenter.render(result.rows, ctx.meta(result, userQuery))
  }

  async delete (ctx) {
    let rescue = await User.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!rescue) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    rescue.destroy()

    ctx.status = 204
    return true
  }

  async updatevirtualhost (ctx) {
    let userQuery = new UserQuery({ id: ctx.params.id }, ctx)
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
    if (result) {
      return HostServ.update(result)
    }
    throw new NotFoundAPIError({ parameter: 'id' })
  }

  getReadPermissionForEntity (ctx, entity) {
    if (entity.id === ctx.state.user.data.id) {
      return ['user.write.me', 'user.write']
    }
    return ['user.write']
  }

  getWritePermissionForEntity (ctx, entity) {
    if (entity.id === ctx.state.user.data.id) {
      return ['user.write.me', 'user.write']
    }
    return ['user.write']
  }

  static get presenter () {
    class UsersPresenter extends APIEndpoint.presenter {
      relationships () {
        return {
          rats: Rats.presenter,
          groups: Groups.presenter,
          displayRat: Rats.presenter
        }
      }
    }
    UsersPresenter.prototype.type = 'users'
    return UsersPresenter
  }
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
        reject(new UnsupportedMediaAPIError({ pointer: '/data' }))
      }

      if (data.size.width < PROFILE_IMAGE_MIN || data.size.height < PROFILE_IMAGE_MIN) {
        reject(new BadRequestAPIError({ pointer: '/data' }))
      }

      gm(imageData).resize(PROFILE_IMAGE_MAX, PROFILE_IMAGE_MAX, '!').toBuffer('JPG', (err, buffer) => {
        if (err) {
          reject(new BadRequestAPIError(({ pointer: '/data' })))
        }
        resolve(buffer)
      })
    })
  })
}

module.exports = Users
