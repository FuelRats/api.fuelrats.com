import {
  RegExpMatcher,
  pattern,
  parseRawPattern,
  assignIncrementingIds,
  collapseDuplicatesTransformer,
  resolveLeetSpeakTransformer,
  resolveConfusablesTransformer,
  toAsciiLowerCaseTransformer,
} from 'obscenity'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const blockedNamesPath = resolve('data/blocked-names.json')

/**
 * Load the blocked names list from disk and build a matcher.
 * Called once at startup — the matcher is reusable.
 * @returns {RegExpMatcher} configured matcher
 */
function buildMatcher () {
  let data = { phrases: [], whitelists: {} }
  try {
    data = JSON.parse(readFileSync(blockedNamesPath, 'utf8'))
  } catch {
    console.warn('blocked-names.json not found or invalid — username filtering disabled')
  }

  const phrases = data.phrases.map((entry) => {
    const term = typeof entry === 'string' ? entry : entry.term
    const phraseWhitelists = (data.whitelists[term] ?? []).map((word) => {
      return { pattern: parseRawPattern(word) }
    })

    return {
      pattern: pattern`${parseRawPattern(term)}`,
      whitelistedTerms: phraseWhitelists,
    }
  })

  assignIncrementingIds(phrases)

  return new RegExpMatcher({
    blacklistedTerms: phrases,
    blacklistMatcherTransformers: [
      toAsciiLowerCaseTransformer(),
      resolveLeetSpeakTransformer(),
      resolveConfusablesTransformer(),
      collapseDuplicatesTransformer(),
    ],
  })
}

const matcher = buildMatcher()

/**
 * Check if a username contains blocked content.
 * @param {string} username the username to check
 * @returns {boolean} true if the username is blocked
 */
export function isBlockedUsername (username) {
  if (!username || typeof username !== 'string') {
    return false
  }
  return matcher.hasMatch(username)
}
