import API, {
  getJSONAPIData,
  POST,
  required,
} from './API'
import Verifications from './Verifications'
import Announcer from '../classes/Announcer'
import Anope from '../classes/Anope'
import {
  BadRequestAPIError,
  ConflictAPIError,
  ForbiddenAPIError,
  UnprocessableEntityAPIError,
} from '../classes/APIError'
import Sessions from '../classes/Sessions'
import StatusCode from '../classes/StatusCode'
import config from '../config'
import {
  User, Rat, Passkey, db, Rescue,
} from '../db'
import { DocumentViewType } from '../Documents/Document'
import ObjectDocument from '../Documents/ObjectDocument'
import { logMetric } from '../logging'
import DatabaseQuery from '../query/DatabaseQuery'

const platforms = ['pc', 'xb', 'ps']

/**
 * @classdesc Endpoint handling user registration
 * @class
 */
export default class Register extends API {
  /**
   * @inheritdoc
   */
  get type () {
    return 'registrations'
  }

  /**
   * Register a new account
   * @endpoint
   */
  @POST('/register')
  @required(
    'email', 'name', 'platform', 'nickname',
  )
  async create (ctx) {
    if (!ctx.state.userAgent) {
      throw new BadRequestAPIError({ parameter: 'User-Agent' })
    }

    if (!ctx.state.fingerprint) {
      throw new BadRequestAPIError({ parameter: 'X-Fingerprint' })
    }

    const formData = getJSONAPIData({ ctx, type: 'registrations' })

    await Register.checkExisting(formData.attributes)
    const {
      email, name, nickname, password, passkeyResponse, platform, expansion = 'horizons3',
    } = formData.attributes

    // Validate that either password or passkey is provided
    if (!password && !passkeyResponse) {
      throw new BadRequestAPIError({
        detail: 'Either password or passkeyResponse must be provided for registration',
      })
    }

    const rescue = await Rescue.findOne({
      where: {
        client: {
          iLike: name,
        },
        status: 'open',
      },
    })
    if (rescue) {
      await Announcer.sendModeratorMessage({
        message: `[Registration] Rejected signup attempt by CMDR ${name} as they have an active case`,
      })
      throw new ForbiddenAPIError({
        pointer: '/data/attributes/name',
      })
    }

    let passkey = null
    let user = null

    // Handle passkey registration if provided
    if (passkeyResponse) {
      // Verify passkey authentication
      const expectedChallenge = ctx.session.passkeyChallenge
      const sessionEmail = ctx.session.passkeyEmail

      if (!expectedChallenge || !sessionEmail || sessionEmail.toLowerCase() !== email.toLowerCase()) {
        throw new BadRequestAPIError({
          detail: 'No valid passkey registration session found for this email',
        })
      }

      // Import WebAuthn verification
      const { verifyRegistrationResponse } = await import('@simplewebauthn/server')
      let verification = null
      try {
        verification = await verifyRegistrationResponse({
          response: passkeyResponse,
          expectedChallenge,
          expectedOrigin: config.server.externalUrl,
          expectedRPID: new URL(config.server.externalUrl).hostname,
        })
      } catch (error) {
        throw new BadRequestAPIError({
          detail: `Passkey verification failed: ${error.message}`,
        })
      }

      if (!verification.verified || !verification.registrationInfo) {
        throw new BadRequestAPIError({
          detail: 'Passkey verification failed',
        })
      }

      const { credentialPublicKey, credentialID, counter, credentialBackedUp } = verification.registrationInfo

      // Clear the passkey session
      delete ctx.session.passkeyChallenge
      delete ctx.session.passkeyEmail

      // Create passkey data for later insertion
      passkey = {
        credentialId: Buffer.from(credentialID).toString('base64url'),
        publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
        counter,
        name: `Registration Key - ${new Date().toLocaleDateString()}`,
        backedUp: credentialBackedUp,
      }
    }

    await db.transaction(async (transaction) => {
      // Create user with or without password
      const userData = { email }
      if (password) {
        userData.password = password
      }

      user = await User.create(userData, { transaction })

      if (platforms.includes(platform) === false) {
        throw new UnprocessableEntityAPIError({
          pointer: '/data/attributes/platform',
        })
      }

      const rat = await Rat.create({
        name,
        platform,
        expansion,
        userId: user.id,
      }, { transaction })

      user.rats = [rat]

      // Create passkey if provided
      if (passkey) {
        await Passkey.create({
          ...passkey,
          userId: user.id,
        }, { transaction })
      }

      // Create Anope account - use temporary password for passkey-only users
      const anopePassword = password ? `bcrypt:${user.password}` : 'passkey-only-account'
      await Anope.addNewUser({
        email,
        nick: nickname,
        encryptedPassword: anopePassword,
        vhost: user.vhost(),
      })

      await Verifications.createVerification(user, transaction)

      const registrationMethod = password ? 'password' : 'passkey'
      await Announcer.sendModeratorMessage({
        message: `[Registration] User with email ${email} registered via ${registrationMethod}. Nickname: ${nickname}.
        CMDR name: ${name} (IP: ${ctx.ip})`,
      })

      return Sessions.createVerifiedSession(ctx, user, transaction)
    })

    // Log registration metrics
    logMetric('user_registration', {
      _user_id: user.id,
      _registration_method: password ? 'password' : 'passkey',
      _platform: platform,
      _expansion: expansion,
      _rat_name: name,
      _nickname: nickname,
      _ip: ctx.ip,
      _user_agent: ctx.state.userAgent?.substring(0, 100) || 'unknown',
      _has_open_rescue: !!rescue,
    }, `User registered: ${user.id} (${password ? 'password' : 'passkey'}) - rat: ${name} on ${platform}`)

    ctx.response.status = StatusCode.created
    return true
  }

  /**
   * Generate passkey registration options for new account registration
   * @endpoint
   */
  @POST('/register/passkey')
  @required('email')
  async generatePasskeyRegistration (ctx) {
    const { email } = getJSONAPIData({ ctx, type: 'passkey-registrations' }).attributes

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        email: { ilike: email },
      },
    })
    if (existingUser) {
      throw new ConflictAPIError({ pointer: '/data/attributes/email' })
    }

    // Generate registration options
    const { generateRegistrationOptions } = await import('@simplewebauthn/server')
    const rpName = 'The Fuel Rats'
    const rpId = new URL(config.server.externalUrl).hostname

    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpId,
      userID: email, // Use email as user ID for registration
      userName: email,
      userDisplayName: email,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    })

    // Store the challenge and email in the session for verification
    ctx.session.passkeyChallenge = options.challenge
    ctx.session.passkeyEmail = email

    const query = new DatabaseQuery({ connection: ctx })
    return new ObjectDocument({
      query,
      result: options,
      type: 'passkey-registrations',
      view: DocumentViewType.individual,
    })
  }

  /**
   * Check if an existing account with this information already exists
   * @param {object} args function arguments object
   * @param {string} args.email account email
   * @param {string} args.name rat name
   * @param {string} args.platform gaming platform
   * @returns {Promise<undefined>} resolves a promise if successful
   */
  static async checkExisting ({ email, name, platform }) {
    const existingUser = await User.findOne({
      where: {
        email: {
          ilike: email,
        },
      },
    })
    if (existingUser) {
      throw new ConflictAPIError({ pointer: '/data/attributes/email' })
    }

    const existingRat = await Rat.findOne({
      where: {
        name: {
          ilike: name,
        },
        platform,
      },
    })
    if (existingRat) {
      throw new ConflictAPIError({ pointer: '/data/attributes/name' })
    }
  }
}
