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
import Permission from '../classes/Permission'
import StatusCode from '../classes/StatusCode'
import { oAuthTokenGenerator } from '../classes/TokenGenerators'
import config from '../config'
import { Passkey, Token, User } from '../db'
import DatabaseDocument from '../Documents/DatabaseDocument'
import { DocumentViewType } from '../Documents/Document'
import ObjectDocument from '../Documents/ObjectDocument'
import issueSession from '../helpers/issueSession'
import { logMetric } from '../logging'
import DatabaseQuery from '../query/DatabaseQuery'
import { PasskeyView } from '../view'
import {
  GET,
  POST,
  DELETE,
  authenticated,
  clientAuthenticated,
  required,
  WritePermission,
} from './API'
import APIResource from './APIResource'

const rpName = 'The Fuel Rats'
const rpId = new URL(config.server.externalUrl).hostname
const expectedOrigins = [
  config.server.externalUrl,
  config.frontend.url,
].filter(Boolean)

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
      userID: new TextEncoder().encode(user.id),
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

    return options
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
        expectedOrigin: expectedOrigins,
        expectedRPID: rpId,
      })
    } catch (error) {
      throw new UnprocessableEntityAPIError({
        pointer: '/data/attributes/response',
        detail: error.message || String(error),
      })
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new UnprocessableEntityAPIError({
        pointer: '/data/attributes/response',
        detail: 'Passkey verification failed',
      })
    }

    const { credential, credentialBackedUp } = verification.registrationInfo

    // Check if this credential is already registered
    const existingPasskey = await Passkey.findOne({
      where: { credentialId: credential.id },
    })

    if (existingPasskey) {
      throw new ConflictAPIError({
        pointer: '/data/attributes/response',
        detail: 'This passkey is already registered',
      })
    }

    const passkey = await Passkey.create({
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
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
    const attributes = ctx.data?.data?.attributes ?? {}
    const { email } = attributes

    let allowCredentials = undefined
    let userId = undefined

    if (email) {
      // Email provided — restrict to that user's passkeys
      const user = await User.findOne({
        where: { email: { ilike: email } },
      })

      if (!user) {
        throw new UnauthorizedAPIError({})
      }

      const userPasskeys = await Passkey.findAll({
        where: { userId: user.id },
      })

      if (userPasskeys.length === 0) {
        throw new UnauthorizedAPIError({})
      }

      allowCredentials = userPasskeys.map((passkey) => {
        return {
          id: passkey.credentialId,
          type: 'public-key',
        }
      })

      userId = user.id
    }
    // No email — discoverable credential flow, allowCredentials left empty

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      allowCredentials,
      userVerification: 'preferred',
    })

    // Store the challenge in the session (userId may be null for discoverable)
    ctx.session.passkeyChallenge = options.challenge
    if (userId) {
      ctx.session.passkeyUserId = userId
    }

    return options
  }

  /**
   * Verify passkey authentication and issue a bearer token
   * @endpoint
   */
  @POST('/passkeys/verify')
  @clientAuthenticated
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
    const sessionUserId = ctx.session.passkeyUserId

    if (!expectedChallenge) {
      throw new UnprocessableEntityAPIError({
        pointer: '/data/attributes/response',
        detail: 'No challenge found in session',
      })
    }

    const { client } = ctx.state

    // Look up the passkey — by credential ID + userId if known, or just credential ID for discoverable
    const passkeyQuery = { credentialId: response.id }
    if (sessionUserId) {
      passkeyQuery.userId = sessionUserId
    }

    const passkey = await Passkey.findOne({ where: passkeyQuery })

    if (!passkey) {
      throw new UnauthorizedAPIError({})
    }

    const userId = passkey.userId

    let verification = null
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: expectedOrigins,
        expectedRPID: rpId,
        credential: {
          id: passkey.credentialId,
          publicKey: Buffer.from(passkey.publicKey, 'base64url'),
          counter: passkey.counter,
        },
      })
    } catch (error) {
      throw new UnprocessableEntityAPIError({
        pointer: '/data/attributes/response',
        detail: error.message || String(error),
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

    // Issue a session + bearer token
    const sessionId = await issueSession({ ctx, userId })
    const token = await Token.create({
      value: await oAuthTokenGenerator(),
      clientId: client.id,
      userId,
      scope: ['*'],
      sessionId,
    })

    // Log passkey authentication metrics
    logMetric('passkey_authentication', {
      _user_id: userId,
      _passkey_id: passkey.id,
      _passkey_name: passkey.name,
      _client_id: client.id,
    }, `Passkey authentication successful: ${passkey.name} for user ${userId}`)

    return {
      access_token: token.value,
      token_type: 'bearer',
    }
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
   * Passkeys use user-level permissions since they are a user sub-resource
   * @inheritdoc
   */
  hasReadPermission ({ connection, entity }) {
    if (this.isSelf({ ctx: connection, entity })) {
      return Permission.granted({ permissions: ['users.read.me', 'users.read'], connection })
    }
    return Permission.granted({ permissions: ['users.read'], connection })
  }

  /**
   * @inheritdoc
   */
  hasWritePermission ({ connection, entity }) {
    if (this.isSelf({ ctx: connection, entity })) {
      return Permission.granted({ permissions: ['users.write.me'], connection })
        || Permission.granted({ permissions: ['users.write'], connection })
    }
    return Permission.granted({ permissions: ['users.write'], connection })
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
