import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import {
  ConflictAPIError,
  NotFoundAPIError,
  UnauthorizedAPIError,
  UnprocessableEntityAPIError,
  UnsupportedMediaAPIError,
} from '../classes/APIError'
import StatusCode from '../classes/StatusCode'
import config from '../config'
import { Passkey, User } from '../db'
import DatabaseDocument from '../Documents/DatabaseDocument'
import { DocumentViewType } from '../Documents/Document'
import ObjectDocument from '../Documents/ObjectDocument'
import { logMetric } from '../logging'
import DatabaseQuery from '../query/DatabaseQuery'
import { PasskeyView } from '../view'
import {
  GET,
  POST,
  DELETE,
  authenticated,
  required,
  WritePermission,
} from './API'
import APIResource from './APIResource'

const rpName = 'The Fuel Rats'
const rpId = new URL(config.server.externalUrl).hostname
const expectedOrigin = config.server.externalUrl

/**
 * Passkeys/WebAuthn API endpoint
 */
export default class Passkeys extends APIResource {
  /**
   * Return JSONAPI type
   * @returns {string} JSONAPI type
   */
  get type () {
    return 'passkeys'
  }

  /**
   * Get user's passkeys
   * @endpoint
   */
  @GET('/users/:id/passkeys')
  @authenticated
  async getUserPasskeys (ctx) {
    const user = await User.findOne({
      where: { id: ctx.params.id },
    })
    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    this.requireReadPermission({ connection: ctx, entity: user })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Passkey.findAndCountAll({
      where: { userId: user.id },
      ...query.searchObject,
    })

    return new DatabaseDocument({ query, result, type: PasskeyView })
  }

  /**
   * Generate passkey registration options
   * @endpoint
   */
  @GET('/users/:id/passkeys/register')
  @authenticated
  async generateRegistrationOptions (ctx) {
    const user = await User.findOne({
      where: { id: ctx.params.id },
    })
    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    this.requireWritePermission({ connection: ctx, entity: user })

    const existingPasskeys = await Passkey.findAll({
      where: { userId: user.id },
    })

    const excludeCredentials = existingPasskeys.map((passkey) => {
      return {
        id: passkey.credentialId,
        type: 'public-key',
      }
    })

    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpId,
      userID: user.id,
      userName: user.email,
      userDisplayName: user.displayName(),
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    })

    // Store the challenge in the session for verification
    ctx.session.passkeyChallenge = options.challenge

    const query = new DatabaseQuery({ connection: ctx })
    return new ObjectDocument({
      query,
      result: options,
      type: PasskeyView,
      view: DocumentViewType.individual,
    })
  }

  /**
   * Register a new passkey
   * @endpoint
   */
  @POST('/users/:id/passkeys')
  @authenticated
  @required('response', 'name')
  async registerPasskey (ctx) {
    const user = await User.findOne({
      where: { id: ctx.params.id },
    })
    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    this.requireWritePermission({ connection: ctx, entity: user })

    const attributes = ctx.data?.data?.attributes
    if (!attributes) {
      throw new UnprocessableEntityAPIError({
        pointer: '/data/attributes',
      })
    }
    const { response, name } = attributes
    const expectedChallenge = ctx.session.passkeyChallenge

    if (!expectedChallenge) {
      throw new UnprocessableEntityAPIError({
        pointer: '/data/attributes/response',
        detail: 'No challenge found in session',
      })
    }

    let verification = null
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpId,
      })
    } catch (error) {
      throw new UnprocessableEntityAPIError({
        pointer: '/data/attributes/response',
        detail: error.message,
      })
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new UnprocessableEntityAPIError({
        pointer: '/data/attributes/response',
        detail: 'Passkey verification failed',
      })
    }

    const { credentialPublicKey, credentialID, counter, credentialBackedUp } = verification.registrationInfo

    // Check if this credential is already registered
    const existingPasskey = await Passkey.findOne({
      where: { credentialId: Buffer.from(credentialID).toString('base64url') },
    })

    if (existingPasskey) {
      throw new ConflictAPIError({
        pointer: '/data/attributes/response',
        detail: 'This passkey is already registered',
      })
    }

    const passkey = await Passkey.create({
      credentialId: Buffer.from(credentialID).toString('base64url'),
      publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
      counter,
      name,
      backedUp: credentialBackedUp,
      userId: user.id,
    })

    // Clear the challenge from the session
    delete ctx.session.passkeyChallenge

    // Log passkey registration metrics
    logMetric('passkey_registered', {
      _user_id: user.id,
      _passkey_id: passkey.id,
      _passkey_name: name,
      _is_backed_up: credentialBackedUp,
      _registered_by_user_id: ctx.state.user.id,
      _is_self_registration: user.id === ctx.state.user.id,
    }, `Passkey registered: ${name} for user ${user.id}`)

    const query = new DatabaseQuery({ connection: ctx })
    ctx.response.status = StatusCode.created
    return new DatabaseDocument({
      query,
      result: passkey,
      type: PasskeyView,
      view: DocumentViewType.individual,
    })
  }

  /**
   * Generate passkey authentication options
   * @endpoint
   */
  @POST('/passkeys/authenticate')
  async generateAuthenticationOptions (ctx) {
    const attributes = ctx.data?.data?.attributes
    if (!attributes) {
      throw new UnprocessableEntityAPIError({
        pointer: '/data/attributes',
      })
    }
    const { email } = attributes

    if (!email) {
      throw new UnprocessableEntityAPIError({
        pointer: '/data/attributes/email',
      })
    }

    const user = await User.findOne({
      where: { email: { ilike: email } },
    })

    if (!user) {
      // Don't reveal if user exists or not
      throw new UnauthorizedAPIError({})
    }

    const userPasskeys = await Passkey.findAll({
      where: { userId: user.id },
    })

    if (userPasskeys.length === 0) {
      throw new UnauthorizedAPIError({})
    }

    const allowCredentials = userPasskeys.map((passkey) => {
      return {
        id: passkey.credentialId,
        type: 'public-key',
      }
    })

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      allowCredentials,
      userVerification: 'preferred',
    })

    // Store the challenge and user ID in the session for verification
    ctx.session.passkeyChallenge = options.challenge
    ctx.session.passkeyUserId = user.id

    const query = new DatabaseQuery({ connection: ctx })
    return new ObjectDocument({
      query,
      result: options,
      type: PasskeyView,
      view: DocumentViewType.individual,
    })
  }

  /**
   * Verify passkey authentication
   * @endpoint
   */
  @POST('/passkeys/verify')
  @required('response')
  async verifyPasskey (ctx) {
    const attributes = ctx.data?.data?.attributes
    if (!attributes) {
      throw new UnprocessableEntityAPIError({
        pointer: '/data/attributes',
      })
    }
    const { response } = attributes
    const expectedChallenge = ctx.session.passkeyChallenge
    const userId = ctx.session.passkeyUserId

    if (!expectedChallenge || !userId) {
      throw new UnprocessableEntityAPIError({
        pointer: '/data/attributes/response',
        detail: 'No challenge found in session',
      })
    }

    const passkey = await Passkey.findOne({
      where: {
        credentialId: response.id,
        userId,
      },
    })

    if (!passkey) {
      throw new UnauthorizedAPIError({})
    }

    let verification = null
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpId,
        authenticator: {
          credentialID: Buffer.from(passkey.credentialId, 'base64url'),
          credentialPublicKey: Buffer.from(passkey.publicKey, 'base64url'),
          counter: passkey.counter,
        },
      })
    } catch (error) {
      throw new UnprocessableEntityAPIError({
        pointer: '/data/attributes/response',
        detail: error.message,
      })
    }

    if (!verification.verified) {
      throw new UnauthorizedAPIError({})
    }

    // Update the counter
    await passkey.update({
      counter: verification.authenticationInfo.newCounter,
    })

    // Clear the challenge from the session
    delete ctx.session.passkeyChallenge
    delete ctx.session.passkeyUserId

    // Log passkey authentication metrics
    logMetric('passkey_authentication', {
      _user_id: userId,
      _passkey_id: passkey.id,
      _passkey_name: passkey.name,
      _counter_updated: verification.authenticationInfo.newCounter !== passkey.counter,
    }, `Passkey authentication successful: ${passkey.name} for user ${userId}`)

    // Return the authenticated user
    const user = await User.findOne({ where: { id: userId } })
    const query = new DatabaseQuery({ connection: ctx })
    return new ObjectDocument({
      query,
      result: { user, verified: true },
      type: PasskeyView,
      view: DocumentViewType.individual,
    })
  }

  /**
   * Delete a passkey
   * @endpoint
   */
  @DELETE('/users/:id/passkeys/:passkeyId')
  @authenticated
  async deletePasskey (ctx) {
    const user = await User.findOne({
      where: { id: ctx.params.id },
    })
    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    this.requireWritePermission({ connection: ctx, entity: user })

    const passkey = await Passkey.findOne({
      where: {
        id: ctx.params.passkeyId,
        userId: user.id,
      },
    })

    if (!passkey) {
      throw new NotFoundAPIError({ parameter: 'passkeyId' })
    }

    // Log passkey deletion metrics
    logMetric('passkey_deleted', {
      _user_id: user.id,
      _passkey_id: passkey.id,
      _passkey_name: passkey.name,
      _deleted_by_user_id: ctx.state.user.id,
      _is_self_deletion: user.id === ctx.state.user.id,
    }, `Passkey deleted: ${passkey.name} for user ${user.id}`)

    await passkey.destroy()
    ctx.response.status = StatusCode.noContent
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
      name: WritePermission.group,
      credentialId: WritePermission.internal,
      publicKey: WritePermission.internal,
      counter: WritePermission.internal,
      backedUp: WritePermission.internal,
      createdAt: WritePermission.internal,
      updatedAt: WritePermission.internal,
    }
  }

  /**
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
