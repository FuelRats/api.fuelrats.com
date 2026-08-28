import { UnprocessableEntityAPIError } from '../classes/APIError'
import { VALID_FLAG_LETTERS } from './groupFlagLetters'

// A group-channel key: a channel name with an optional leading '#'/'&' (the
// stored convention omits the prefix). Excludes whitespace and comma — the same
// separators the module's command-injection guard rejects.
const CHANNEL_KEY_PATTERN = /^[#&]?[^\s,]{1,50}$/u

/**
 * Whether a group-channel key is a well-formed channel name.
 * @param {*} channel candidate channel key
 * @returns {boolean} true if usable as a Group.channels key
 */
export function isValidChannelKey (channel) {
  return typeof channel === 'string' && CHANNEL_KEY_PATTERN.test(channel)
}

/**
 * Validate a `Group.channels` map (`{ "#chan": "OVH", ... }`).
 *
 * Correctness guard at the write boundary: a malformed channel name or an
 * invalid/empty FLAGS string here would otherwise become (or silently fail to
 * become) a durable ChanServ mode grant via groupsync. Throws on the first
 * offending entry.
 * @param {*} channels the channels map being written
 * @throws {UnprocessableEntityAPIError} when any entry is malformed
 */
export function assertValidGroupChannels (channels) {
  if (channels === null || typeof channels === 'undefined') {
    return
  }

  if (typeof channels !== 'object' || Array.isArray(channels)) {
    throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/channels' })
  }

  for (const [channel, flags] of Object.entries(channels)) {
    if (!isValidChannelKey(channel)) {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/channels' })
    }
    if (typeof flags !== 'string'
      || flags.length === 0
      || ![...flags].every((letter) => VALID_FLAG_LETTERS.has(letter))) {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/channels' })
    }
  }
}
