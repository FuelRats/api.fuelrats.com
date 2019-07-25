import { User } from '../db'
import { UserView } from '../view'
import Query from '../query/Query'
import bcrypt from 'bcrypt'
import Permission from '../classes/Permission'
import Anope from '../classes/Anope'

import workerpool from 'workerpool'

import {
  NotFoundAPIError,
  UnauthorizedAPIError,
  UnsupportedMediaAPIError,
  BadRequestAPIError
} from '../classes/APIError'

import API, {
  WritePermission,
  permissions,
  authenticated,
  GET,
  POST,
  PUT,
  DELETE,
  parameters,
  disallow,
  required,
  protect, PATCH
} from '../classes/API'
import { websocket } from '../classes/WebSocket'
import DatabaseQuery from '../query/DatabaseQuery'
import DatabaseDocument from '../Documents/DatabaseDocument'
import { DocumentViewType } from '../Documents/Document'

/**
 * Class for the /users endpoint
 */
export default class Users extends API {
  static imageResizePool = workerpool.pool('./dist/workers/image.js')
  static sslGenerationPool = workerpool.pool('./dist/workers/certificate.js')

  get type () {
    return 'users'
  }


  @GET('/users')
  @websocket('users', 'search')
  @authenticated
  @permissions('user.read')
  async search (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await User.findAndCountAll(query.searchObject)
    return new DatabaseDocument({ query, result, type: UserView })
  }

  @GET('/users/:id')
  @websocket('users', 'read')
  @authenticated
  @permissions('user.read')
  @parameters('id')
  async findById (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await User.findOne({
      where: {
        id: ctx.params.id
      }
    })
    if (!result) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    return new DatabaseDocument({ query, result, type: UserView })
  }

  @GET('/users/:id/image')
  @websocket('users', 'image', 'read')
  async image (ctx, next) {
    const user = await User.scope('image')
      .findByPk(ctx.params.id)
    ctx.type = 'image/jpeg'
    ctx.body = user.image
    next()
  }

  @GET('/users/:id/certificate')
  @authenticated
  async certificate (ctx) {
    const ratName = ctx.state.user.preferredRat.name
    const { certificate, fingerprint }  = await Users.sslGenerationPool.exec('generateSslCertificate',
      [ratName])

    const anopeAccount = await Anope.getAccount(ctx.state.user.email)
    if (!anopeAccount) {
      throw new BadRequestAPIError()
    }

    await Anope.setFingerprint(ctx.state.user.email, fingerprint)
    ctx.set('Content-disposition', `attachment; filename=${ratName}.pem`)
    ctx.set('Content-type', 'application/x-pem-file')
    ctx.body = certificate
  }

  @PUT('/users/:id/password')
  @websocket('users', 'setpassword')
  @authenticated
  @required('password', 'new')
  async setpassword (ctx) {
    const user = await User.findOne({
      where: {
        id: ctx.state.user.id
      }
    })

    const validatePassword = await bcrypt.compare(ctx.data.password, user.password)
    if (!validatePassword) {
      throw new UnauthorizedAPIError({ pointer: '/data/attributes/password' })
    }

    user.password = ctx.data.new

    await user.save()

    const userQuery = new Query({ params: { id: ctx.state.user.id }, connection: ctx })
    const result = await User.findAndCountAll(userQuery.toSequelize)
    return Users.presenter.render(result.rows, API.meta(result, userQuery))
  }

  @POST('/users')
  @websocket('users', 'create')
  @authenticated
  @permissions('user.create')
  @protect('user.write', 'suspended', 'status')
  @disallow('image', 'password')
  async create (ctx) {
    const result = await super.create({ ctx, databaseType: User })

    const query = new DatabaseQuery({ connection: ctx })
    ctx.response.status = 201
    return new DatabaseDocument({ query, result, type: UserView })
  }

  @PUT('/users/:id')
  @websocket('users', 'update')
  @authenticated
  @protect('user.write', 'suspended', 'status')
  @disallow('image', 'password')
  async update (ctx) {
    const result = await super.update({ ctx, databaseType: User, updateSearch: { id: ctx.params.id } })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: UserView })
  }

  @DELETE('/users/:id')
  @websocket('users', 'delete')
  @required('password')
  async delete (ctx) {
    await super.delete({ ctx, databaseType: User })

    ctx.response.status = 204
    return true
  }

  @POST('/users/:id/image')
  @websocket('users', 'image')
  @authenticated
  async setimage (ctx) {
    const user = await User.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission({ connection: ctx, entity: user })

    const imageData = ctx.req._readableState.buffer.head.data

    const formattedImageData = await Users.imageResizePool.exec('avatarImageResize', [imageData])

    await User.update({
      image: formattedImageData
    }, {
      where: { id: ctx.params.id }
    })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await User.findOne({
      where: {
        id: ctx.params.id
      }
    })
    return new DatabaseDocument({ query, result, type: UserView })
  }

  // relationships

  @GET('/users/:id/relationships/rats')
  @websocket('users', 'rats', 'read')
  @authenticated
  async relationshipRatsView (ctx) {
    const result = await this.relationshipView({
      ctx,
      databaseType: User,
      relationship: 'rats'
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.relationship })
  }

  @POST('/users/:id/relationships/rats')
  @websocket('users', 'rats', 'create')
  @authenticated
  async relationshipRatsCreate (ctx) {
    const result = await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'add',
      relationship: 'rats'
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.meta })
  }

  @PATCH('/users/:id/relationships/rats')
  @websocket('users', 'rats', 'patch')
  @authenticated
  async relationshipRatsPatch (ctx) {
    const result = await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'patch',
      relationship: 'rats'
    })

    const query = new DatabaseQuery({ connection: ctx })

    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.meta })
  }

  @DELETE('/users/:id/relationships/rats')
  @websocket('users', 'rats', 'delete')
  @authenticated
  async relationshipRatsDelete (ctx) {
    const result = await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'remove',
      relationship: 'rats'
    })

    const query = new DatabaseQuery({ connection: ctx })

    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.meta })
  }

  @GET('/users/:id/relationships/displayRat')
  @websocket('users', 'displayRat', 'read')
  @authenticated
  async relationshipDisplayRatView (ctx) {
    const result = await this.relationshipView({
      ctx,
      databaseType: User,
      relationship: 'displayRat'
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.meta })
  }

  @PATCH('/users/:id/relationships/displayRat')
  @websocket('users', 'displayRat', 'patch')
  @authenticated
  async relationshipFirstLimpetPatch (ctx) {
    const result = await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'patch',
      relationship: 'displayRat'
    })

    const query = new DatabaseQuery({ connection: ctx })

    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.meta })
  }


  get writePermissionsForFieldAccess () {
    return {
      data: WritePermission.group,
      email: WritePermission.sudo,
      password: WritePermission.sudo,
      status: WritePermission.sudo,
      suspended: WritePermission.internal,
      frontierId: WritePermission.internal,
      createdAt: WritePermission.internal,
      updatedAt: WritePermission.internal,
      deletedAt: WritePermission.internal
    }
  }

  isInternal ({ ctx }) {
    return Permission.granted({ permissions: ['user.internal'], user: ctx.state.user, scope: ctx.state.scope })
  }


  isGroup ({ ctx, entity }) {
    return Permission.granted({ permissions: ['user.write'], user: ctx.state.user, scope: ctx.state.scope })
  }

  isSelf ({ ctx, entity }) {
    if (entity.id === ctx.state.user.id) {
      return Permission.granted({ permissions: ['user.write.me'], user: ctx.state.user, scope: ctx.state.scope })
    }
    return false
  }

  getReadPermissionFor ({ connection, entity }) {
    if (entity.id === connection.state.user.id) {
      return ['user.write.me', 'user.write']
    }
    return ['user.write']
  }

  getWritePermissionFor ({ connection, entity }) {
    if (entity.displayRatId) {
      const rat = connection.state.user.included.find((include) => {
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

  changeRelationship ({ relationship }) {
    switch (relationship) {
      case 'rats':
        return {
          many: true,

          add ({ entity, ids }) {
            return entity.addRats(ids)
          },

          patch ({ entity, ids }) {
            return entity.setRats(ids)
          },

          remove ({ entity, ids }) {
            return entity.removeRats(ids)
          }
        }

      case 'displayRat':
        return {
          many: false,

          add ({ entity, id }) {
            return entity.addRat(id)
          },

          patch ({ entity, id }) {
            return entity.setRat(id)
          },

          remove ({ entity, id }) {
            return entity.removeRat(id)
          }
        }

      case 'groups':
        return {
          many: true,

          add ({ entity, ids }) {
            return entity.addGroups(ids)
          },

          patch ({ entity, ids }) {
            return entity.setGroups(ids)
          },

          remove ({ entity, ids }) {
            return entity.removeGroups(ids)
          }
        }

      case 'clients':
        return {
          many: true,

          add ({ entity, ids }) {
            return entity.addClients(ids)
          },

          patch ({ entity, ids }) {
            return entity.setClients(ids)
          },

          remove ({ entity, ids }) {
            return entity.removeClients(ids)
          }
        }

      default:
        throw new UnsupportedMediaAPIError({ pointer: '/relationships' })
    }
  }

  get relationTypes () {
    return {
      'rats': 'rats',
      'displayRat': 'rats',
      'groups': 'groups',
      'clients': 'clients'
    }
  }
}
