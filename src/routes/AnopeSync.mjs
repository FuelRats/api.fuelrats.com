import { BadRequestAPIError, NotFoundAPIError } from '../classes/APIError'
import { Group, User } from '../db'
import API, {
  GET,
  POST,
  authenticated,
  permissions,
} from './API'

const EMAIL_MAX_LENGTH = 254
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u
const BULK_MAX_EMAILS = 200

/**
 * Whether a value is a syntactically valid, length-bounded email address.
 * Guards against enumeration/abuse of this internal endpoint (Risk 46).
 * @param {*} email candidate email
 * @returns {boolean} true if usable as a lookup key
 */
function isValidEmail (email) {
  return typeof email === 'string'
    && email.length > 0
    && email.length <= EMAIL_MAX_LENGTH
    && EMAIL_PATTERN.test(email)
}

/**
 * Flatten `User.flags()` into single per-channel flag-letter strings.
 * `flags()` yields `{ "chan": ["HV", "V"] }` (one FLAGS string per contributing group);
 * the module wants `{ "#chan": "HV" }` — the deduped union of letters, channel names
 * prefixed with `#` (case preserved; the module matches case-insensitively).
 * @param {object|undefined} flags output of `User.flags()`
 * @returns {object} `{ "#channel": "letters" }` — empty object means "no channel access"
 */
function flattenChannels (flags) {
  const channels = {}
  if (!flags) {
    return channels
  }
  for (const [channel, flagList] of Object.entries(flags)) {
    const letters = flagList.join('').replace(/[^a-zA-Z]/gu, '')
    const deduped = [...new Set(letters.split(''))].join('')
    const key = channel.startsWith('#') ? channel : `#${channel}`
    channels[key] = deduped
  }
  return channels
}

/**
 * The module-facing view of a user: their merged channel access and roles.
 * Each role carries the group machine `name` (used by the module as a stable
 * SWHOIS line tag) and a human `display` (the whois text).
 * @param {User} user a user loaded with its `groups`
 * @returns {{channels: object, roles: Array<{name: string, display: string}>}} groupsync payload
 */
function anopeView (user) {
  const roles = (user.groups ?? []).map((group) => ({
    name: group.name,
    display: group.displayName || group.name,
  }))
  return { channels: flattenChannels(user.flags()), roles }
}

/**
 * Look up a single user by email with only the associations groupsync needs.
 * Bypasses the heavy default User scope — loads groups only (Risk performance).
 * @param {string} email address to resolve (case-insensitive)
 * @returns {Promise<User|null>} the user, or null if not found
 */
function findUserByEmail (email) {
  return User.unscoped().findOne({
    where: { email: { ilike: email } },
    attributes: ['id', 'email'],
    include: [{
      model: Group,
      as: 'groups',
      required: false,
      through: { attributes: [] },
      order: [['priority', 'DESC']],
    }],
  })
}

/**
 * Internal endpoint for the Anope groupsync module.
 * Returns a user's merged IRC channel access and role names, keyed by email.
 * Authentication/vhost are out of scope — this endpoint only serves channel roles.
 */
export default class AnopeSync extends API {
  get type () {
    return 'anope'
  }

  /**
   * GET /anope?email= - channel access + roles for one user
   * @endpoint
   */
  @GET('/anope')
  @authenticated
  @permissions('anope.read')
  async getPermissions (ctx) {
    const { email } = ctx.query
    if (!isValidEmail(email)) {
      throw new BadRequestAPIError({ parameter: 'email' })
    }

    const user = await findUserByEmail(email)
    if (!user) {
      throw new NotFoundAPIError({ parameter: 'email' })
    }

    ctx._status = 200
    return anopeView(user)
  }

  /**
   * POST /anope/bulk - channel access + roles for many users at once
   * Body: `{ "emails": ["a@b.c", ...] }` (max 200). Unknown emails are omitted.
   * @endpoint
   */
  @POST('/anope/bulk')
  @authenticated
  @permissions('anope.read')
  async getBulkPermissions (ctx) {
    const emails = ctx.data?.emails
    if (!Array.isArray(emails) || emails.length === 0) {
      throw new BadRequestAPIError({ pointer: '/emails' })
    }
    if (emails.length > BULK_MAX_EMAILS) {
      throw new BadRequestAPIError({ pointer: '/emails' })
    }
    if (!emails.every(isValidEmail)) {
      throw new BadRequestAPIError({ pointer: '/emails' })
    }

    const users = await User.unscoped().findAll({
      where: { email: { in: emails } },
      attributes: ['id', 'email'],
      include: [{
        model: Group,
        as: 'groups',
        required: false,
        through: { attributes: [] },
        order: [['priority', 'DESC']],
      }],
    })

    const byEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]))
    const result = {}
    for (const email of emails) {
      const user = byEmail.get(email.toLowerCase())
      if (user) {
        result[email] = anopeView(user)
      }
    }

    ctx._status = 200
    return result
  }
}
