import {
  RegExpMatcher,
  DataSet,
  parseRawPattern,
  resolveLeetSpeakTransformer,
  resolveConfusablesTransformer,
  toAsciiLowerCaseTransformer,
} from 'obscenity'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const blockedNamesPath = resolve('data/blocked-names.json')

/**
 * Load the blocked names list from disk and build matchers.
 * Called once at startup — the matchers are reusable.
 * @returns {{ main: RegExpMatcher, literal: RegExpMatcher }} configured matchers
 */
function buildMatchers () {
  let data = { blocked: [], blocked_word_boundary: [] }
  try {
    data = JSON.parse(readFileSync(blockedNamesPath, 'utf8'))
  } catch {
    console.warn('blocked-names.json not found or invalid — username filtering disabled')
  }

  const mainDataset = new DataSet()
  const literalDataset = new DataSet()

  // Substring matches — blocked anywhere in the name
  for (const term of (data.blocked ?? [])) {
    // Purely numeric terms break with leet speak transformer, use literal matcher
    if (/^\d+$/u.test(term)) {
      literalDataset.addPhrase((phrase) => {
        return phrase.addPattern(parseRawPattern(term))
      })
    } else {
      mainDataset.addPhrase((phrase) => {
        return phrase.addPattern(parseRawPattern(term))
      })
    }
  }

  // Word-boundary matches — only blocked as a standalone word
  for (const term of (data.blocked_word_boundary ?? [])) {
    const raw = parseRawPattern(term)
    raw.requireWordBoundaryAtStart = true
    raw.requireWordBoundaryAtEnd = true
    mainDataset.addPhrase((phrase) => {
      return phrase.addPattern(raw)
    })
  }

  const main = new RegExpMatcher({
    ...mainDataset.build(),
    blacklistMatcherTransformers: [
      toAsciiLowerCaseTransformer(),
      resolveLeetSpeakTransformer(),
      resolveConfusablesTransformer(),
    ],
  })

  const literal = new RegExpMatcher({
    ...literalDataset.build(),
    blacklistMatcherTransformers: [
      toAsciiLowerCaseTransformer(),
    ],
  })

  return { main, literal }
}

const { main: mainMatcher, literal: literalMatcher } = buildMatchers()

/**
 * Check if a username contains blocked content.
 * @param {string} username the username to check
 * @returns {boolean} true if the username is blocked
 */
export function isBlockedUsername (username) {
  if (!username || typeof username !== 'string') {
    return false
  }
  return mainMatcher.hasMatch(username) || literalMatcher.hasMatch(username)
}
