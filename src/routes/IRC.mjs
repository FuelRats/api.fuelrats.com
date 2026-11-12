import Anope from '../classes/Anope'
import { BadRequestAPIError, ForbiddenAPIError, ServiceUnavailableAPIError } from '../classes/APIError'
import config from '../config'
import { Token } from '../db'
import { mintSaslToken, saslTokenLifetimeSeconds } from '../helpers/saslToken'
import { IRCNickname } from '../helpers/Validators'
import { logMetric } from '../logging'
import API, {
  POST,
  authenticated,
  permissions,
} from './API'

const millisecondsPerSecond = 1000

/**
 * Refusal for a user whose email has no Anope account. `links.about` points at the profile page,
 * where registering a nickname creates the account.
 */
class AnopeAccountRequiredAPIError extends BadRequestAPIError {
  get links () {
    return {
      about: `${config.frontend.url}/profile/overview`,
    }
  }
}

/**
 * Refusal for a user who has not verified the email address of their website account. The Anope account is
 * found by that email, so an unverified address must not lead to an IRC login. `links.about` points at the
 * profile page, which offers to send the verification email again. Thrown with `source.pointer` `/email`,
 * which tells it apart from the no-account refusal: both are 400 with the same link.
 */
class VerifiedEmailRequiredAPIError extends BadRequestAPIError {
  get detail () {
    return 'Verify the email address of your Fuel Rats account before logging in to IRC with it'
  }

  get links () {
    return {
      about: `${config.frontend.url}/profile/overview`,
    }
  }
}

/**
 * IRC login credentials for the authenticated user
 */
export default class IRC extends API {
  get type () {
    return 'irc'
  }

  /**
   * POST /irc/sasl-token - mint a one-time SASL PLAIN password for an alias of the user's own Anope account.
   * Body: `{ "nick": "<alias>" }`, optional; without it the account's display nick is used.
   * Responds `{ account, password, expiresIn }`, where `account` is the alias as registered and must be
   * sent unchanged as the SASL authcid.
   * @endpoint
   */
  @POST('/irc/sasl-token')
  @authenticated
  @permissions('irc.login')
  async saslToken (ctx) {
    const { tokenSecret } = config.irc
    if (!tokenSecret) {
      throw new ServiceUnavailableAPIError({})
    }

    // While representing, ctx.state.user is the represented user, so a token would log the caller in to IRC
    // as them. The caller is known only through the bearer token, whose row names the user it was issued to.
    if (ctx.get('x-representing')) {
      const { currentTokenValue } = ctx.state
      const callerToken = currentTokenValue ? await Token.findOne({ where: { value: currentTokenValue } }) : null
      const callerUserId = callerToken?.userId
      logMetric('irc_sasl_token_representing_refused', {
        _caller_user_id: callerUserId,
        _client_id: ctx.state.clientId,
        _represented_user_id: ctx.state.user.id,
      }, `IRC SASL token refused for user ${callerUserId ?? 'unknown'} representing user ${ctx.state.user.id}`)
      throw new ForbiddenAPIError({ parameter: 'x-representing' })
    }

    const nick = ctx.data?.nick ?? undefined
    if (typeof nick !== 'undefined' && (typeof nick !== 'string' || IRCNickname.test(nick) === false)) {
      throw new BadRequestAPIError({ pointer: '/nick' })
    }

    const { user } = ctx.state
    if (!user.isConfirmed()) {
      throw new VerifiedEmailRequiredAPIError({ pointer: '/email' })
    }

    const anopeAccount = await Anope.getAccount(user.email)
    if (!anopeAccount) {
      throw new AnopeAccountRequiredAPIError({})
    }

    // getAccount joins one arbitrary alias, so the alias is looked up on the account itself. An alias
    // that does not exist and one that belongs to another account get the same refusal.
    const account = await Anope.findAccountAlias(anopeAccount.uniqueid, nick ?? anopeAccount.display)
    if (!account) {
      if (typeof nick !== 'undefined') {
        throw new BadRequestAPIError({ pointer: '/nick' })
      }
      throw new AnopeAccountRequiredAPIError({})
    }

    const ts = Math.floor(Date.now() / millisecondsPerSecond)
    const password = mintSaslToken(tokenSecret, account, ts)

    logMetric('irc_sasl_token_issued', {
      _user_id: user.id,
      _client_id: ctx.state.clientId,
      _irc_account: account,
      _nick_requested: typeof nick !== 'undefined',
    }, `IRC SASL token issued for user ${user.id} (account: ${account})`)

    ctx._status = 200
    return {
      account,
      password,
      expiresIn: saslTokenLifetimeSeconds,
    }
  }
}
