import { authenticator as totp } from 'otplib'
import UUID from 'pure-uuid'
import { DocumentViewType } from '../Documents/Document'
import ObjectDocument from '../Documents/ObjectDocument'
import {
  ConflictAPIError,
  NotFoundAPIError, UnauthorizedAPIError,
  UnprocessableEntityAPIError,
  UnsupportedMediaAPIError
} from '../classes/APIError'
import { Authenticator, User } from '../db'
import DatabaseQuery from '../query/DatabaseQuery'
import { GeneratedAuthenticatorView } from '../view'
import {
  GET,
  POST,
  DELETE,
  getJSONAPIData,
  authenticated,
  required, WritePermission,
} from './API'
import StatusCode from '../classes/StatusCode'
import APIResource from './APIResource.mjs'

export default class Authenticators extends APIResource {
  get type () {
    return 'users'
  }

  @GET('/users/:id/authenticator')
  @authenticated
  async generateAuthenticator (ctx) {
    const user = await User.findOne({
      id: ctx.params.id
    })
    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    this.requireReadPermission({ connection: ctx, entity: user })

    const existingAuthenticator = await Authenticator.findOne({
      where: {
        userId: user.id,
      },
    })


    if (existingAuthenticator) {
      throw new ConflictAPIError({
        parameter: 'id',
      })
    }

    const secret = totp.generateSecret()
    const dataUri = totp.keyuri(ctx.state.user.email, 'Fuel Rats', secret)
    const result = {
      id: new UUID(4),
      secret,
      dataUri,
      user: ctx.state.user,
    }

    const query = new DatabaseQuery({ connection: ctx })
    return new ObjectDocument({ query, result, type: GeneratedAuthenticatorView, view: DocumentViewType.individual })
  }

  @POST('/users/:id/authenticator')
  @authenticated
  @required('secret', 'token', 'description')
  async addAuthenticator (ctx) {
    const user = await User.findOne({
      id: ctx.params.id
    })
    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    this.requireWritePermission({ connection: ctx, entity: user })

    const existingAuthenticator = await Authenticator.findOne({
      where: {
        userId: user.id,
      },
    })

    if (existingAuthenticator) {
      throw new ConflictAPIError({
        parameter: 'id',
      })
    }

    const { token, secret, description } = getJSONAPIData({ ctx, type: 'authenticators' })?.attributes

    let isValid = false
    try {
      isValid = totp.check(token, secret)

    } catch (ex) {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/secret' })
    }

    if (!isValid) {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/token' })
    }

    await Authenticator.create({
      description,
      secret,
      userId: ctx.state.user.id,
    })

    ctx.response.status = StatusCode.created
    return true
  }

  @DELETE('/users/:id/authenticator')
  @authenticated
  async removeAuthenticator (ctx) {
    const user = await User.findOne({
      id: ctx.params.id
    })
    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    this.requireWritePermission({ connection: ctx, entity: user })

    const existingAuthenticator = await Authenticator.findOne({
      where: {
        userId: user.id,
      },
    })

    if (!existingAuthenticator) {
      throw new NotFoundAPIError({
        parameter: 'id',
      })
    }

    const verifyHeader = ctx.req.headers['x-verify']
    let verified
    try {
      verified = totp.check(verifyHeader, existingAuthenticator.secret)
    } catch {
      verified = false
    }

    if (!verified) {
      throw new UnauthorizedAPIError({ pointer: 'x-verify' })
    }

    await existingAuthenticator.destroy()
    return true
  }

  /**
   * @inheritdoc
   */
  isSelf ({ ctx, entity }) {
    return entity.userId === ctx.state.user.id
  }

  /**
   * @inheritdoc
   */
  get writePermissionsForFieldAccess () {
    return {
      secret: WritePermission.group,
      description: WritePermission.group,
      createdAt: WritePermission.internal,
      updatedAt: WritePermission.internal,
    }
  }

  /**
   *
   * @inheritdoc
   */
  changeRelationship ({ relationship }) {
    throw new UnsupportedMediaAPIError({ pointer: '/relationships' })
  }

  /**
   * @inheritdoc
   */
  get relationTypes () {
    return {}
  }
}
