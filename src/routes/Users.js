import { User } from '../db'
import { UserView } from '../view'
import bcrypt from 'bcrypt'
import Permission from '../classes/Permission'
import Anope from '../classes/Anope'
import workerpool from 'workerpool'
import StatusCode from '../classes/StatusCode'
import Decals from './Decals'

import {
  NotFoundAPIError,
  UnauthorizedAPIError,
  UnsupportedMediaAPIError,
  BadRequestAPIError
} from '../classes/APIError'

import {
  APIResource,
  Context,
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
  protect,
  PATCH,
  getJSONAPIData
} from '../classes/API'
import { websocket } from '../classes/WebSocket'
import DatabaseQuery from '../query/DatabaseQuery'
import DatabaseDocument from '../Documents/DatabaseDocument'
import { DocumentViewType } from '../Documents/Document'

/**
 * Class for the /users endpoint
 */
export default class Users extends APIResource {
  static imageResizePool = workerpool.pool('./dist/workers/image.js')
  static sslGenerationPool = workerpool.pool('./dist/workers/certificate.js')

  /**
   * @inheritdoc
   */
  get type () {
    return 'users'
  }

  /**
   * Get a list of users according to a search query
   * @param {Context} ctx a request context
   * @returns {Promise<DatabaseDocument>} JSONAPI result document
   */
  @GET('/users')
  @websocket('users', 'search')
  @authenticated
  @permissions('user.read')
  async search (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const results = await User.findAndCountAll(query.searchObject)
    const result = await Anope.mapNicknames(results)

    return new DatabaseDocument({ query, result, type: UserView })
  }

  /**
   * Get a specific user by ID
   * @param {Context} ctx a request context
   * @returns {Promise<DatabaseDocument>} JSONAPI result document
   */
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

    const user = await Anope.mapNickname(result)
    return new DatabaseDocument({ query, result: user, type: UserView })
  }

  @GET('/profile')
  @websocket('profiles', 'read')
  @authenticated
  async profile (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await User.findOne({
      where: {
        id: ctx.state.user.id
      }
    })

    const redeemable = await Decals.getEligibleDecalCount({ user: ctx.state.user })

    const user = await Anope.mapNickname(result)
    return new DatabaseDocument({ query, result: user, type: UserView, meta: { redeemable } })
  }

  /**
   * Get a user's avatar
   * @param {Context} ctx a request context
   * @param {Function} next Koa routing function
   * @returns {Promise<undefined>} resolves a promise upon completion
   */
  @GET('/users/:id/image')
  @websocket('users', 'image', 'read')
  async image (ctx, next) {
    const user = await User.scope('image')
      .findByPk(ctx.params.id)
    ctx.type = 'image/jpeg'
    ctx.body = user.image
    next()
  }

  /**
   * Generate and set a certificate for use with IRC identification
   * @param {Context} ctx request context
   * @returns {Promise<undefined>} resolves a promise upon completion
   */
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

  /**
   * Change a user's password
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} an updated user if the password change is successful
   */
  @PUT('/users/:id/password')
  @websocket('users', 'password', 'update')
  @authenticated
  @required('password', 'new')
  async setPassword (ctx) {
    const { password, newPassword } = getJSONAPIData({ ctx, type: 'password-changes' })

    const user = await User.findOne({
      where: {
        id: ctx.params.id
      }
    })

    this.requireWritePermission({ connection: ctx, entity: user })

    const validatePassword = await bcrypt.compare(password, user.password)
    if (!validatePassword) {
      throw new UnauthorizedAPIError({ pointer: '/data/attributes/password' })
    }

    user.password = newPassword
    await user.save()

    const result = await Anope.mapNickname(user)

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: UserView })
  }

  /**
   * Endpoint for admins to create new users. For self-creating a user, see /register
   * @param {Context} ctx a request context
   * @returns {Promise<DatabaseDocument>} a created user if the request is successful
   */
  @POST('/users')
  @websocket('users', 'create')
  @authenticated
  @permissions('user.write')
  @protect('user.write', 'suspended', 'status')
  @disallow('image', 'password')
  async create (ctx) {
    const user = await super.create({ ctx, databaseType: User })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Anope.mapNickname(user)

    ctx.response.status = StatusCode.created
    return new DatabaseDocument({ query, result, type: UserView })
  }

  /**
   * Update a user
   * @param {Context} ctx a requset context
   * @returns {Promise<DatabaseDocument>} an updated user if the request is successful
   */
  @PUT('/users/:id')
  @websocket('users', 'update')
  @authenticated
  @protect('user.write', 'suspended', 'status')
  @disallow('image', 'password')
  async update (ctx) {
    const user = await super.update({ ctx, databaseType: User, updateSearch: { id: ctx.params.id } })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Anope.mapNickname(user)
    return new DatabaseDocument({ query, result, type: UserView })
  }

  /**
   * Delete a user
   * @param {Context} ctx a request context
   * @returns {Promise<boolean>} returns a 204 if the request is successful
   */
  @DELETE('/users/:id')
  @websocket('users', 'delete')
  async delete (ctx) {

    await super.delete({ ctx, databaseType: User, callback: (user) => {
      return Anope.deleteAccount(user.email)
    } })

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Update a user's avatar image
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} an updated user if the request is successful
   */
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

  // Relationships

  /**
   * Get a user's rat relationships
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} a list of a user's rat relationships
   */
  @GET('/users/:id/relationships/rats')
  @websocket('users', 'rats', 'read')
  @authenticated
  async relationshipRatsView (ctx) {
    const user = await this.relationshipView({
      ctx,
      databaseType: User,
      relationship: 'rats'
    })

    const result = await Anope.mapNickname(user)

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.relationship })
  }

  /**
   * Create new rat relationship(s) on a user
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} an updated user with updated relationships
   */
  @POST('/users/:id/relationships/rats')
  @websocket('users', 'rats', 'create')
  @authenticated
  async relationshipRatsCreate (ctx) {
    const user = await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'add',
      relationship: 'rats'
    })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Anope.mapNickname(user)
    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.meta })
  }

  /**
   * Override a user's rat relationships with a new set
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} an updated user with updated relationships
   */
  @PATCH('/users/:id/relationships/rats')
  @websocket('users', 'rats', 'patch')
  @authenticated
  async relationshipRatsPatch (ctx) {
    const user = await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'patch',
      relationship: 'rats'
    })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Anope.mapNickname(user)

    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.meta })
  }

  /**
   * Delete one or more rat relationships of a user
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} an updated user with updated relationships
   */
  @DELETE('/users/:id/relationships/rats')
  @websocket('users', 'rats', 'delete')
  @authenticated
  async relationshipRatsDelete (ctx) {
    const user = await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'remove',
      relationship: 'rats'
    })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Anope.mapNickname(user)

    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.meta })
  }

  /**
   * Get a user's display rat relationship
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} a user's display rat relationship
   */
  @GET('/users/:id/relationships/displayRat')
  @websocket('users', 'displayRat', 'read')
  @authenticated
  async relationshipDisplayRatView (ctx) {
    const user = await this.relationshipView({
      ctx,
      databaseType: User,
      relationship: 'displayRat'
    })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Anope.mapNickname(user)
    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.meta })
  }

  /**
   * Set a user's display rat relationship
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} an updated user with updated relationships
   */
  @PATCH('/users/:id/relationships/displayRat')
  @websocket('users', 'displayRat', 'patch')
  @authenticated
  async relationshipFirstLimpetPatch (ctx) {
    const user = await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'patch',
      relationship: 'displayRat'
    })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Anope.mapNickname(user)

    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.meta })
  }

  /**
   * Get a user's group relationships
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} a list of a user's group relationships
   */
  @GET('/users/:id/relationships/groups')
  @websocket('users', 'groups', 'read')
  @authenticated
  async relationshipGroupsView (ctx) {
    const user = await this.relationshipView({
      ctx,
      databaseType: User,
      relationship: 'groups'
    })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Anope.mapNickname(user)
    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.relationship })
  }

  /**
   * Create new group relationship(s) on a user
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} an updated user with updated relationships
   */
  @POST('/users/:id/relationships/groups')
  @websocket('users', 'groups', 'create')
  @authenticated
  async relationshipGroupsCreate (ctx) {
    const user = await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'add',
      relationship: 'groups'
    })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Anope.mapNickname(user)
    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.meta })
  }

  /**
   * Override a user's group relationships with a new set
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} an updated user with updated relationships
   */
  @PATCH('/users/:id/relationships/groups')
  @websocket('users', 'groups', 'patch')
  @authenticated
  async relationshipGroupsPatch (ctx) {
    const user = await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'patch',
      relationship: 'groups'
    })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Anope.mapNickname(user)

    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.meta })
  }

  /**
   * Delete one or more group relationships of a user
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} an updated user with updated relationships
   */
  @DELETE('/users/:id/relationships/groups')
  @websocket('users', 'groups', 'delete')
  @authenticated
  async relationshipGroupsDelete (ctx) {
    const user = await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'remove',
      relationship: 'groups'
    })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Anope.mapNickname(user)

    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.meta })
  }

  /**
   * Get a user's client relationships
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} a list of a user's client relationships
   */
  @GET('/users/:id/relationships/clients')
  @websocket('users', 'clients', 'read')
  @authenticated
  async relationshipClientsView (ctx) {
    const user = await this.relationshipView({
      ctx,
      databaseType: User,
      relationship: 'clients'
    })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Anope.mapNickname(user)
    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.relationship })
  }

  /**
   * Create new client relationship(s) on a user
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} an updated user with updated relationships
   */
  @POST('/users/:id/relationships/clients')
  @websocket('users', 'clients', 'create')
  @authenticated
  async relationshipClientsCreate (ctx) {
    const user = await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'add',
      relationship: 'clients'
    })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Anope.mapNickname(user)
    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.meta })
  }

  /**
   * Override a user's client relationships with a new set
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} an updated user with updated relationships
   */
  @PATCH('/users/:id/relationships/clients')
  @websocket('users', 'clients', 'patch')
  @authenticated
  async relationshipClientsPatch (ctx) {
    const user = await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'patch',
      relationship: 'clients'
    })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Anope.mapNickname(user)

    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.meta })
  }

  /**
   * Delete one or more client relationships of a user
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} an updated user with updated relationships
   */
  @DELETE('/users/:id/relationships/clients')
  @websocket('users', 'clients', 'delete')
  @authenticated
  async relationshipClientsDelete (ctx) {
    const user = await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'remove',
      relationship: 'clients'
    })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Anope.mapNickname(user)

    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.meta })
  }


  /**
   * @inheritdoc
   */
  get writePermissionsForFieldAccess () {
    return {
      data: WritePermission.group,
      email: WritePermission.sudo,
      password: WritePermission.sudo,
      status: WritePermission.sudo,
      suspended: WritePermission.sudo,
      frontierId: WritePermission.internal,
      createdAt: WritePermission.internal,
      updatedAt: WritePermission.internal,
      deletedAt: WritePermission.internal
    }
  }

  /**
   * @inheritdoc
   */
  isSelf ({ ctx, entity }) {
    return entity.id === ctx.state.user.id
  }

  /**
   *
   * @inheritdoc
   */
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

          patch ({ entity, id }) {
            return entity.setRat(id)
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

  /**
   * @inheritdoc
   */
  get relationTypes () {
    return {
      'rats': 'rats',
      'displayRat': 'rats',
      'groups': 'groups',
      'clients': 'clients'
    }
  }
}
