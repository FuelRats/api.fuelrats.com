import Anope from '../classes/Anope'
import { BadRequestAPIError, ServiceUnavailableAPIError } from '../classes/APIError'
import config from '../config'
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

    const nick = ctx.data?.nick ?? undefined
    if (typeof nick !== 'undefined' && (typeof nick !== 'string' || IRCNickname.test(nick) === false)) {
      throw new BadRequestAPIError({ pointer: '/nick' })
    }

    const { user } = ctx.state
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
