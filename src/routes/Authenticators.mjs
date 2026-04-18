import { generateSecret, generateURI, verifySync } from 'otplib'
import UUID from 'pure-uuid'
import {
  ConflictAPIError,
  NotFoundAPIError, UnauthorizedAPIError,
  UnprocessableEntityAPIError,
  UnsupportedMediaAPIError,
} from '../classes/APIError'
import StatusCode from '../classes/StatusCode'
import { Authenticator, User } from '../db'
import { DocumentViewType } from '../Documents/Document'
import ObjectDocument from '../Documents/ObjectDocument'
import { generateRecoveryCodes, verifyRecoveryCode } from '../helpers/recoveryCodes'
import { logMetric } from '../logging'
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
import APIResource from './APIResource'

const UUID_VERSION = 4

/**
 *
 */
export default class Authenticators extends APIResource {
  /**
   * Return JSONAPI type
   * @returns {string} JSONAPI type
   */
  get type () {
    return 'users'
  }

  /**
   * Request an authenticator secret
   * @endpoint
   */
  @GET('/users/:id/authenticator')
  @authenticated
  async generateAuthenticator (ctx) {
    const user = await User.findOne({
      where: { id: ctx.params.id },
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

    const secret = generateSecret()
    const dataUri = generateURI({ type: 'totp', accountName: ctx.state.user.email, issuer: 'Fuel Rats', secret })
    const result = {
      id: new UUID(UUID_VERSION),
      secret,
      dataUri,
      user: ctx.state.user,
    }

    const query = new DatabaseQuery({ connection: ctx })
    return new ObjectDocument({ query, result, type: GeneratedAuthenticatorView, view: DocumentViewType.individual })
  }

  /**
   * Link an authenticator
   * @endpoint
   */
  @POST('/users/:id/authenticator')
  @authenticated
  @required('secret', 'token', 'description')
  async addAuthenticator (ctx) {
    const user = await User.findOne({
      where: { id: ctx.params.id },
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

    const { token, secret, description } = getJSONAPIData({ ctx, type: 'authenticators' })?.attributes ?? {}

    let isValid
    try {
      isValid = verifySync({ token, secret }).valid
    } catch {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/secret' })
    }

    if (!isValid) {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/token' })
    }

    const { raw: recoveryCodes, hashes: recoveryCodeHashes } = await generateRecoveryCodes()

    await Authenticator.create({
      description,
      secret,
      recoveryCodes: recoveryCodeHashes,
      userId: ctx.state.user.id,
    })

    // Log 2FA setup metrics
    logMetric('authenticator_added', {
      _user_id: ctx.state.user.id,
      _setup_by_user_id: ctx.state.user.id,
      _is_self_setup: user.id === ctx.state.user.id,
      _description: description?.substring(0, 50) || 'no_description',  
    }, `2FA authenticator added for user ${ctx.state.user.id}`)

    ctx.response.status = StatusCode.created
    return { recoveryCodes }
  }

  /**
   * Regenerate recovery codes for an existing authenticator.
   * Requires a valid TOTP code or existing recovery code via x-verify header.
   * @endpoint
   */
  @POST('/users/:id/authenticator/recovery-codes')
  @authenticated
  async regenerateRecoveryCodes (ctx) {
    const user = await User.findOne({
      where: { id: ctx.params.id },
    })
    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    this.requireWritePermission({ connection: ctx, entity: user })

    const existingAuthenticator = await Authenticator.findOne({
      where: { userId: user.id },
    })
    if (!existingAuthenticator) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    const verifyHeader = ctx.get('x-verify')
    let verified
    try {
      verified = verifySync({ token: verifyHeader, secret: existingAuthenticator.secret }).valid
    } catch {
      verified = false
    }

    if (!verified) {
      const matchIndex = await verifyRecoveryCode(verifyHeader, existingAuthenticator.recoveryCodes)
      if (matchIndex !== -1) {
        verified = true
        const remaining = existingAuthenticator.recoveryCodes.filter((_, i) => {
          return i !== matchIndex
        })
        await existingAuthenticator.update({ recoveryCodes: remaining })
      }
    }

    if (!verified) {
      throw new UnauthorizedAPIError({ pointer: 'x-verify' })
    }

    const { raw: recoveryCodes, hashes: recoveryCodeHashes } = await generateRecoveryCodes()
    await existingAuthenticator.update({ recoveryCodes: recoveryCodeHashes })

    logMetric('authenticator_recovery_codes_regenerated', {
      _user_id: user.id,
      _regenerated_by_user_id: ctx.state.user.id,
    }, `2FA recovery codes regenerated for user ${user.id}`)

    return { recoveryCodes }
  }

  /**
   * Delete an authenticator
   * @endpoint
   */
  @DELETE('/users/:id/authenticator')
  @authenticated
  async removeAuthenticator (ctx) {
    const user = await User.findOne({
      where: { id: ctx.params.id },
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

    const verifyHeader = ctx.get('x-verify')
    let verified
    try {
      verified = verifySync({ token: verifyHeader, secret: existingAuthenticator.secret }).valid
    } catch {
      verified = false
    }

    if (!verified) {
      const matchIndex = await verifyRecoveryCode(verifyHeader, existingAuthenticator.recoveryCodes)
      if (matchIndex !== -1) {
        verified = true
      }
    }

    if (!verified) {
      throw new UnauthorizedAPIError({ pointer: 'x-verify' })
    }

    await existingAuthenticator.destroy()

    // Log 2FA removal metrics
    logMetric('authenticator_removed', {
      _user_id: user.id,
      _removed_by_user_id: ctx.state.user.id,
      _is_self_removal: user.id === ctx.state.user.id,
      _description: existingAuthenticator.description?.substring(0, 50) || 'no_description',  
    }, `2FA authenticator removed for user ${user.id}`)

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
  changeRelationship () {
    throw new UnsupportedMediaAPIError({ pointer: '/relationships' })
  }

  /**
   * @inheritdoc
   */
  get relationTypes () {
    return {}
  }
}
