import bcrypt from 'bcrypt'
import { promises as fsp } from 'fs'
import workerpool from 'workerpool'
import {
  WritePermission,
  permissions,
  authenticated,
  GET,
  POST,
  PUT,
  DELETE,
  parameters,
  required,
  PATCH,
  getJSONAPIData,
} from './API'
import APIResource from './APIResource'
import Decals from './Decals'
import Verifications from './Verifications'
import Announcer from '../classes/Announcer'
import Anope from '../classes/Anope'
import {
  NotFoundAPIError,
  UnauthorizedAPIError,
  UnsupportedMediaAPIError,
  BadRequestAPIError,
  InternalServerError,
  ImATeapotAPIError,
} from '../classes/APIError'
import { Context } from '../classes/Context'
import Event from '../classes/Event'
import Jira from '../classes/Jira'
import Mail from '../classes/Mail'
import Permission from '../classes/Permission'
import StatusCode from '../classes/StatusCode'
import { websocket } from '../classes/WebSocket'
import { User, Decal, Avatar, db } from '../db'
import DatabaseDocument from '../Documents/DatabaseDocument'
import { DocumentViewType } from '../Documents/Document'
import emailChangeEmail from '../emails/emailchange'
import DatabaseQuery from '../query/DatabaseQuery'
import {
  UserView, DecalView, RatView, ClientView, GroupView,
} from '../view'

const mail = new Mail()

const avatarCacheTime = 604800000 // 1 Week
const validAvatarFormats = ['webp', 'png', 'jpeg']
const defaultAvatarFormat = 'webp'
const avatarMinSize = 32
const avatarMaxSize = 256

/**
 * Class for the /users endpoint
 */
export default class Users extends APIResource {
  static imageFormatPool = workerpool.pool('./dist/workers/image.mjs')
  static sslGenerationPool = workerpool.pool('./dist/workers/certificate.mjs')

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
  @parameters('id')
  async findById (ctx) {
    const { query, result } = await super.findById({ ctx, databaseType: User })

    const user = await Anope.mapNickname(result)
    return new DatabaseDocument({ query, result: user, type: UserView })
  }

  /**
   * Get a user's profile
   * @endpoint
   */
  @GET('/profile')
  @websocket('profiles', 'read')
  @authenticated
  async profile (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await User.findOne({
      where: {
        id: ctx.state.user.id,
      },
    })


    const user = await Anope.mapNickname(result)
    user.redeemable = await Decals.getEligibleDecalCount({ user: ctx.state.user })
    return new DatabaseDocument({ query, result: user, type: UserView })
  }

  /**
   * Get a user's avatar
   * @param {Context} ctx a request context
   * @param {Function} next Koa routing function
   * @returns {Promise<undefined>} resolves a promise upon completion
   */
  @GET('/users/:id/image')
  @websocket('users', 'image', 'read')
  @parameters('id')
  async image (ctx, next) {
    const avatar = await Avatar.scope('imageData').findOne({
      where: {
        userId: ctx.params.id,
      },
    })
    if (!avatar) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    const { format = defaultAvatarFormat } = ctx.query
    const size = parseInt(ctx.query.size ?? avatarMaxSize, 10)

    if (format !== defaultAvatarFormat || size !== avatarMaxSize) {
      if (!validAvatarFormats.includes(format)) {
        throw new BadRequestAPIError({ parameter: 'format' })
      }


      if (Number.isNaN(size) || size < avatarMinSize || size > avatarMaxSize) {
        throw new BadRequestAPIError({ parameter: 'size' })
      }

      ctx.body = await Users.convertImageData(avatar.image, { format, size })
    } else {
      ctx.body = avatar.image
    }

    ctx.set('Expires', new Date(Date.now() + avatarCacheTime).toUTCString())
    ctx.type = `image/${format}`

    next()
  }

  /**
   * Generate and set a certificate for use with IRC identification
   * @param {Context} ctx request context
   * @returns {Promise<undefined>} resolves a promise upon completion
   *
   * Disabled due to FRVE-2. Pending re-implementation when frontend is ready.
   */
  // @GET('/users/:id/certificate')
  // @parameters('id')
  // @authenticated
  // async certificate (ctx) {
  //   const ratName = ctx.state.user.preferredRat().name
  //   const { certificate, fingerprint } = await Users.sslGenerationPool.exec('generateSslCertificate',
  //     [ratName])

  //   const anopeAccount = await Anope.getAccount(ctx.state.user.email)
  //   if (!anopeAccount) {
  //     throw new BadRequestAPIError()
  //   }

  //   await Anope.setFingerprint(ctx.state.user.email, fingerprint)
  //   ctx.set('Content-disposition', `attachment; filename=${ratName}.pem`)
  //   ctx.set('Content-type', 'application/x-pem-file')
  //   ctx.body = certificate
  // }

  /**
   * Change a user's email
   * @endpoint
   */
  @PUT('/users/:id/email')
  @websocket('users', 'email', 'update')
  @parameters('id')
  @authenticated
  @required()
  async setEmail (ctx) {
    const { email: newEmail } = getJSONAPIData({ ctx, type: 'email-changes' }).attributes

    const user = await User.findOne({
      where: {
        id: ctx.params.id,
      },
    })

    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    const oldEmail = user.email

    this.requireWritePermission({ connection: ctx, entity: user })

    await db.transaction(async (transaction) => {
      user.email = newEmail
      await user.save({ transaction })
      const verifiedGroup = user.groups.find((group) => {
        return group.name === 'verified'
      })
      if (verifiedGroup) {
        await user.removeGroup(verifiedGroup, { transaction })
      }

      await Verifications.createVerification(user, transaction, true)
      await mail.send(emailChangeEmail({ email: oldEmail, name: user.displayName(), newEmail }))

      await Announcer.sendModeratorMessage({
        message: `[Account Change] User with email ${oldEmail} has changed their email to ${newEmail}`,
      })

      return user
    })

    await Jira.setEmail(user.displayName(), newEmail)
    await Anope.setEmail(oldEmail, newEmail)

    const result = await Anope.mapNickname(user)

    Event.broadcast('fuelrats.userupdate', ctx.state.user, user.id, {})
    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: UserView })
  }

  /**
   * Change a user's password
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} an updated user if the password change is successful
   */
  @PUT('/users/:id/password')
  @websocket('users', 'password', 'update')
  @parameters('id')
  @authenticated
  @required('password', 'newPassword')
  async setPassword (ctx) {
    const { password, newPassword } = getJSONAPIData({ ctx, type: 'password-changes' }).attributes

    const user = await User.findOne({
      where: {
        id: ctx.params.id,
      },
    })

    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission({ connection: ctx, entity: user })

    const validatePassword = await bcrypt.compare(password, user.password)
    if (!validatePassword) {
      throw new UnauthorizedAPIError({ pointer: '/data/attributes/password' })
    }

    await db.transaction(async (transaction) => {
      user.password = newPassword
      await user.save({ transaction })
      await Anope.setPassword(user.email, newPassword)

      return user
    })

    const result = await Anope.mapNickname(user)
    Event.broadcast('fuelrats.userupdate', ctx.state.user, user.id, {})
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
  @permissions('users.write')
  async create (ctx) {
    const user = await super.create({ ctx, databaseType: User })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Anope.mapNickname(user)

    ctx.response.status = StatusCode.created
    return new DatabaseDocument({ query, result, type: UserView })
  }

  /**
   * Update a user
   * @param {Context} ctx a request context
   * @returns {Promise<DatabaseDocument>} an updated user if the request is successful
   */
  @PUT('/users/:id')
  @websocket('users', 'update')
  @parameters('id')
  @authenticated
  async update (ctx) {
    const user = await super.update({ ctx, databaseType: User, updateSearch: { id: ctx.params.id } })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Anope.mapNickname(user)
    Event.broadcast('fuelrats.userupdate', ctx.state.user, user.id, {})
    return new DatabaseDocument({ query, result, type: UserView })
  }

  /**
   * Delete a user
   * @param {Context} ctx a request context
   * @returns {Promise<boolean>} returns a 204 if the request is successful
   */
  @DELETE('/users/:id')
  @websocket('users', 'delete')
  @parameters('id')
  @authenticated
  async delete (ctx) {
    await super.delete({
      ctx,
      databaseType: User,
    })

    await Anope.deleteAccount(ctx.state.user.email)

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Update a user's avatar image
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} an updated user if the request is successful
   */
  @POST('/users/:id/image')
  @parameters('id')
  @authenticated
  async setimage (ctx) {
    const user = await User.findOne({
      where: {
        id: ctx.params.id,
      },
    })

    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission({ connection: ctx, entity: user })

    if (!ctx.request.files?.image) {
      throw new ImATeapotAPIError()
    }

    const imageData = await fsp.readFile(ctx.request.files.image.path)

    const formattedImageData = await Users.convertImageData(imageData)

    await Avatar.destroy({
      where: {
        userId: ctx.params.id,
      },
    })

    await Avatar.create({
      image: formattedImageData,
      userId: ctx.params.id,
    })

    Event.broadcast('fuelrats.userupdate', ctx.state.user, user.id, {})
    const query = new DatabaseQuery({ connection: ctx })
    const result = await User.findOne({
      where: {
        id: ctx.params.id,
      },
    })
    return new DatabaseDocument({ query, result, type: UserView })
  }

  /**
   * Redeem a decal
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} a decal
   */
  @POST('/users/:id/decals')
  @parameters('id')
  @authenticated
  async redeemDecal (ctx) {
    const user = await User.findOne({
      where: {
        id: ctx.params.id,
      },
    })

    this.requireWritePermission({ connection: ctx, entity: user })

    const redeemable = await Decals.getEligibleDecalCount({ user })
    if (redeemable < 1) {
      throw new BadRequestAPIError({})
    }

    const availableDecal = await Decal.findOne({
      where: {
        userId: { is: undefined },
        claimedAt: { is: undefined },
        type: 'Rescues',
      },
    })

    if (!availableDecal) {
      throw new InternalServerError({})
    }

    const result = await availableDecal.update({
      userId: user.id,
      claimedAt: Date.now(),
    })

    Event.broadcast('fuelrats.userupdate', ctx.state.user, user.id, {})
    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: DecalView })
  }

  // Relationships

  /**
   * Get a user's rat relationships
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} a list of a user's rat relationships
   */
  @GET('/users/:id/relationships/rats')
  @websocket('users', 'rats', 'read')
  @parameters('id')
  @authenticated
  async relationshipRatsView (ctx) {
    const result = await this.relationshipView({
      ctx,
      databaseType: User,
      relationship: 'rats',
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: RatView, view: DocumentViewType.relationship })
  }

  /**
   * Create new rat relationship(s) on a user
   * @param {Context} ctx request context
   * @returns {Promise<boolean>} 204 no content
   */
  @POST('/users/:id/relationships/rats')
  @websocket('users', 'rats', 'create')
  @parameters('id')
  @authenticated
  async relationshipRatsCreate (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'add',
      relationship: 'rats',
    })

    Event.broadcast('fuelrats.userupdate', ctx.state.user, ctx.params.id, {})
    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Override a user's rat relationships with a new set
   * @param {Context} ctx request context
   * @returns {Promise<boolean>} 204 no content
   */
  @PATCH('/users/:id/relationships/rats')
  @websocket('users', 'rats', 'patch')
  @parameters('id')
  @authenticated
  async relationshipRatsPatch (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'patch',
      relationship: 'rats',
    })

    Event.broadcast('fuelrats.userupdate', ctx.state.user, ctx.params.id, {})
    // I'm sorry Clapton, JSONAPI made me do it
    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Delete one or more rat relationships of a user
   * @param {Context} ctx request context
   * @returns {Promise<boolean>} 204 no content
   */
  @DELETE('/users/:id/relationships/rats')
  @websocket('users', 'rats', 'delete')
  @parameters('id')
  @authenticated
  async relationshipRatsDelete (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'remove',
      relationship: 'rats',
    })

    Event.broadcast('fuelrats.userupdate', ctx.state.user, ctx.params.id, {})
    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Get a user's display rat relationship
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} a user's display rat relationship
   */
  @GET('/users/:id/relationships/displayRat')
  @websocket('users', 'displayRat', 'read')
  @parameters('id')
  @authenticated
  async relationshipDisplayRatView (ctx) {
    const result = await this.relationshipView({
      ctx,
      databaseType: User,
      relationship: 'displayRat',
    })

    Event.broadcast('fuelrats.userupdate', ctx.state.user, ctx.params.id, {})

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: RatView, view: DocumentViewType.relationship })
  }

  /**
   * Set a user's display rat relationship
   * @param {Context} ctx request context
   * @returns {Promise<boolean>} 204 no content
   */
  @PATCH('/users/:id/relationships/displayRat')
  @websocket('users', 'displayRat', 'patch')
  @parameters('id')
  @authenticated
  async relationshipDisplayRatPatch (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'patch',
      relationship: 'displayRat',
    })

    Event.broadcast('fuelrats.userupdate', ctx.state.user, ctx.params.id, {})
    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Get a user's group relationships
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} a list of a user's group relationships
   */
  @GET('/users/:id/relationships/groups')
  @websocket('users', 'groups', 'read')
  @parameters('id')
  @authenticated
  async relationshipGroupsView (ctx) {
    const result = await this.relationshipView({
      ctx,
      databaseType: User,
      relationship: 'groups',
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: GroupView, view: DocumentViewType.relationship })
  }

  /**
   * Create new group relationship(s) on a user
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument|boolean>} 204 no content
   */
  @POST('/users/:id/relationships/groups')
  @websocket('users', 'groups', 'create')
  @parameters('id')
  @authenticated
  async relationshipGroupsCreate (ctx) {
    const { updatedEntity } = await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'add',
      relationship: 'groups',
    })

    await Anope.updatePermissions(updatedEntity)
    Event.broadcast('fuelrats.userupdate', ctx.state.user, ctx.params.id, {})
    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Override a user's group relationships with a new set
   * @param {Context} ctx request context
   * @returns {Promise<boolean>} 204 no content
   */
  @PATCH('/users/:id/relationships/groups')
  @websocket('users', 'groups', 'patch')
  @parameters('id')
  @authenticated
  async relationshipGroupsPatch (ctx) {
    const { updatedEntity } = await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'patch',
      relationship: 'groups',
    })

    await Anope.updatePermissions(updatedEntity)

    Event.broadcast('fuelrats.userupdate', ctx.state.user, ctx.params.id, {})
    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Delete one or more group relationships of a user
   * @param {Context} ctx request context
   * @returns {Promise<boolean>} 204 no content
   */
  @DELETE('/users/:id/relationships/groups')
  @websocket('users', 'groups', 'delete')
  @parameters('id')
  @authenticated
  async relationshipGroupsDelete (ctx) {
    const { entity, updatedEntity } = await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'remove',
      relationship: 'groups',
    })

    const removedGroupPermissions = ctx.data.data.map((group) => {
      const entityGroup = entity.groups.find((userGroup) => {
        return userGroup.id.toLowerCase() === group.id.toLowerCase()
      })
      return Anope.removeChannelPermissions(entity, entityGroup)
    })
    await Promise.all(removedGroupPermissions)
    Anope.updatePermissions(updatedEntity)

    Event.broadcast('fuelrats.userupdate', ctx.state.user, ctx.params.id, {})
    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Get a user's client relationships
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} a list of a user's client relationships
   */
  @GET('/users/:id/relationships/clients')
  @websocket('users', 'clients', 'read')
  @parameters('id')
  @authenticated
  async relationshipClientsView (ctx) {
    const result = await this.relationshipView({
      ctx,
      databaseType: User,
      relationship: 'clients',
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: ClientView, view: DocumentViewType.relationship })
  }

  /**
   * Create new client relationship(s) on a user
   * @param {Context} ctx request context
   * @returns {Promise<boolean>} 204 no content
   */
  @POST('/users/:id/relationships/clients')
  @websocket('users', 'clients', 'create')
  @parameters('id')
  @authenticated
  async relationshipClientsCreate (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'add',
      relationship: 'clients',
    })

    Event.broadcast('fuelrats.userupdate', ctx.state.user, ctx.params.id, {})
    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Override a user's client relationships with a new set
   * @param {Context} ctx request context
   * @returns {Promise<boolean>} 204 no content
   */
  @PATCH('/users/:id/relationships/clients')
  @websocket('users', 'clients', 'patch')
  @parameters('id')
  @authenticated
  async relationshipClientsPatch (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'patch',
      relationship: 'clients',
    })

    Event.broadcast('fuelrats.userupdate', ctx.state.user, ctx.params.id, {})
    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Delete one or more client relationships of a user
   * @param {Context} ctx request context
   * @returns {Promise<boolean>} 204 no content
   */
  @DELETE('/users/:id/relationships/clients')
  @websocket('users', 'clients', 'delete')
  @parameters('id')
  @authenticated
  async relationshipClientsDelete (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: User,
      change: 'remove',
      relationship: 'clients',
    })

    Event.broadcast('fuelrats.userupdate', ctx.state.user, ctx.params.id, {})
    ctx.response.status = StatusCode.noContent
    return true
  }


  /**
   * @inheritdoc
   */
  get writePermissionsForFieldAccess () {
    return {
      data: WritePermission.group,
      email: WritePermission.sudo,
      password: WritePermission.sudo,
      status: (ctx, entity, value) => {
        if (ctx.state.user.permissions.includes('users.write')) {
          return true
        }

        if (entity && entity.id === ctx.state.user.id && value === 'deactivated') {
          return false
          // return ctx.state.basicAuth === true
        }
        return false
      },
      suspended: WritePermission.sudo,
      stripeId: WritePermission.group,
      frontierId: WritePermission.internal,
      createdAt: WritePermission.internal,
      updatedAt: WritePermission.internal,
      deletedAt: WritePermission.internal,
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

          hasPermission (connection) {
            return Permission.granted({ permissions: ['rats.write'], connection })
          },

          add ({ entity, ids, transaction }) {
            return entity.addRats(ids, { transaction })
          },

          patch ({ entity, ids, transaction }) {
            return entity.setRats(ids, { transaction })
          },

          remove ({ entity, ids, transaction }) {
            return entity.removeRats(ids, { transaction })
          },
        }

      case 'displayRat':
        return {
          many: false,

          hasPermission (connection, entity, id) {
            const hasRat = connection.state.user.rats.some((rat) => {
              return rat.id === id
            })
            return hasRat || Permission.granted({ permissions: ['rats.write'], connection })
          },

          patch ({ entity, id, transaction }) {
            return entity.setDisplayRat(id, { transaction })
          },
        }

      case 'groups':
        return {
          many: true,

          hasPermission (connection) {
            return Permission.granted({ permissions: ['groups.write'], connection })
          },

          add ({ entity, ids, transaction }) {
            return entity.addGroups(ids, { transaction })
          },

          patch ({ entity, ids, transaction }) {
            return entity.setGroups(ids, { transaction })
          },

          remove ({ entity, ids, transaction }) {
            return entity.removeGroups(ids, { transaction })
          },
        }

      case 'clients':
        return {
          many: true,

          hasPermission (connection) {
            return Permission.granted({ permissions: ['clients.write'], connection })
          },

          add ({ entity, ids, transaction }) {
            return entity.addClients(ids, { transaction })
          },

          patch ({ entity, ids, transaction }) {
            return entity.setClients(ids, { transaction })
          },

          remove ({ entity, ids, transaction }) {
            return entity.removeClients(ids, { transaction })
          },
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
      rats: 'rats',
      displayRat: 'rats',
      groups: 'groups',
      clients: 'clients',
    }
  }

  /**
   * Contact the image processing web worker to process an image into the correct format and size
   * @param {Buffer} originalImageData the original image data
   * @param {object?} options Output options for the transformed image data
   * @param {number?} options.size Output size of the image
   * @param {string?} options.format Output format of the image
   * @returns {Promise<Buffer>} processed image data
   */
  static async convertImageData (originalImageData, options = {}) {
    try {
      return Buffer.from(await Users.imageFormatPool.exec('avatarImageFormat', [originalImageData, {
        size: options.size ?? avatarMaxSize,
        format: options.format ?? defaultAvatarFormat,
      }]))
    } catch (error) {
      if (error.message.includes('unsupported image format')) {
        // Thrown when input format is unsupported
        throw new UnsupportedMediaAPIError({})
      } else {
        throw error
      }
    }
  }
}
