

import { User, Rat, db } from '../db'

import Authentication from '../classes/Authentication'
import Document from '../classes/Document'
import UserView from '../views/User'
import Query from '../query'
import HostServ from '../Anope/HostServ'
import bcrypt from 'bcrypt'
import gm from 'gm'
import Rats from './Rats'
import Groups from './Groups'
const {
  NotFoundAPIError,
  UnauthorizedAPIError,
  UnsupportedMediaAPIError,
  BadRequestAPIError
} = require('../classes/APIError')

import API, {
  permissions,
  authenticated,
  GET,
  POST,
  PUT,
  DELETE,
  parameters,
  disallow,
  required,
  protect
} from '../classes/API'
import { websocket } from '../classes/WebSocket'

const PROFILE_IMAGE_MIN = 64
const PROFILE_IMAGE_MAX = 100

export default class Users extends API {
  @GET('/users')
  @websocket('users', 'search')
  @authenticated
  @permissions('user.read')
  async search (ctx) {
    let userQuery = new Query({ params: ctx.query, connection: ctx })
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
    // return Users.presenter.render(result.rows, API.meta(result, userQuery))
    return new Document({ objects: result.rows, type: UserView, meta: API.meta(result, userQuery) })
  }

  @GET('/users/:id')
  @websocket('users', 'read')
  @authenticated
  @permissions('user.read')
  @parameters('id')
  async findById (ctx) {
    let userQuery = new Query({ params: { id: ctx.params.id }, connection: ctx })
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)

    return Users.presenter.render(result.rows, API.meta(result, userQuery))
  }

  async image (ctx, next) {
    let user = await User.scope('image').findById(ctx.params.id)
    ctx.type = 'image/jpeg'
    ctx.body = user.image
    next()
  }

  @PUT('/users/setpassword')
  @websocket('users', 'setpassword')
  @authenticated
  @required('password', 'new')
  async setpassword (ctx) {
    let user = await User.findOne({
      where: {
        id: ctx.state.user.id
      }
    })

    let validatePassword = await bcrypt.compare(ctx.data.password, user.password)
    if (!validatePassword) {
      throw new UnauthorizedAPIError({ pointer: '/data/attributes/password' })
    }

    user.password = ctx.data.new

    await user.save()

    let userQuery = new Query({ params: {id: ctx.state.user.id}, connection: ctx })
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
    return Users.presenter.render(result.rows, API.meta(result, userQuery))
  }

  @POST('/users')
  @websocket('users', 'create')
  @authenticated
  @permissions('user.create')
  @protect('user.write', 'suspended', 'status')
  @disallow('image', 'password')
  async create (ctx) {
    let user = await User.create(ctx.data)
    await user.addGroup('default')

    let userQuery = new Query({ params: { id: user.id }, connection: ctx })
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
    ctx.response.status = 201

    return Users.presenter.render(result, API.meta(result))
  }

  @PUT('/users/:id')
  @websocket('users', 'update')
  @authenticated
  @protect('user.write', 'suspended', 'status')
  @disallow('image', 'password')
  async update (ctx) {
    this.requireWritePermission({ connection: ctx, entity: ctx.data })

    let user = await User.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission({ connection: ctx, entity: user })

    await User.update(ctx.data, {
      where: {
        id: ctx.params.id
      }
    })

    let userQuery = new Query({ params: {id: ctx.params.id}, connection: ctx })
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
    return Users.presenter.render(result.rows, API.meta(result, userQuery))
  }

  @DELETE('/users/:id')
  @websocket('users', 'delete')
  @required('password')
  async delete (ctx) {
    let user = await User.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!user) {
      throw new NotFoundAPIError({parameter: 'id'})
    }

    this.requireWritePermission({connection: ctx, entity: user})

    let isAuthenticated = await Authentication.passwordAuthenticate({email: user.email, password: ctx.data.password})
    if (!isAuthenticated) {
      throw new UnauthorizedAPIError({pointer: '/data/attributes/password'})
    }

    let rats = await Rat.findAll({
      where: {
        userId: ctx.params.id
      }
    })


    let transaction = await db.transaction()

    try {
      await Promise.all(rats.map((rat) => {
        return rat.destroy({ transaction })
      }))
      await user.destroy({ transaction })

      await transaction.commit()
    } catch (ex) {
      transaction.rollback()
      throw ex
    }

    ctx.status = 204
    return true
  }

  @POST('/users/image/:id')
  @websocket('users', 'image')
  @authenticated
  async setimage (ctx) {
    let user = await User.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission({connection: ctx, entity: user})

    let imageData = ctx.req._readableState.buffer.head.data

    let formattedImageData = await formatImage(imageData)
    await User.update({
      image: formattedImageData
    }, {
      where: {id: ctx.params.id}
    })

    let userQuery = new UserQuery({ params: {id: ctx.params.id}, connection: ctx })
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
    return Users.presenter.render(result.rows, API.meta(result, userQuery))
  }

  @PUT('/users/updatevirtualhost/:id')
  @websocket('users', 'updatevirtualhost')
  @authenticated
  @permissions('user.write')
  async updatevirtualhost (ctx) {
    let userQuery = new Query({ params: { id: ctx.params.id }, connection: ctx })
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
    if (result) {
      return HostServ.update(result)
    }
    throw new NotFoundAPIError({ parameter: 'id' })
  }

  getReadPermissionFor ({ connection, entity }) {
    if (entity.id === connection.state.user.id) {
      return ['user.write.me', 'user.write']
    }
    return ['user.write']
  }

  getWritePermissionForEntity ({ connection, entity }) {
    if (entity.displayRatId) {
      let rat = connection.state.user.included.find((include) => {
        return include.id === entity.displayRatId
      })
      if (!rat) {
        return ['user.write']
      }
    }
    if (entity.id === connection.state.user.id) {
      return ['user.write.me', 'user.write']
    }
    return ['user.write']
  }

  static get presenter () {
    class UsersPresenter extends API.presenter {
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
