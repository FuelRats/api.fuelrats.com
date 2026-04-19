/**
 * Detect platform and expansion from free-text message content.
 * Word lists sourced from SwiftSqueak's signal scanner and enum parsers.
 */

const platformPatterns = [
  { platform: 'pc', words: ['pc'] },
  { platform: 'xb', words: ['xbox', 'xb', 'xb1', 'xbox one', 'xrats'] },
  { platform: 'ps', words: ['ps', 'ps4', 'ps5', 'playstation', 'playstation 4', 'playstation 5', 'psrats'] },
]

const expansionPatterns = [
  { expansion: 'horizons3', words: ['legacy', 'horizons 3', 'horizons3', 'horizons 3.8', 'h3', '3h', 'leg'] },
  { expansion: 'horizons4', words: ['horizons', 'horizons 4', 'horizons4', 'horizons 4.0', 'h4', '4h', 'hor', 'live'] },
  { expansion: 'odyssey', words: ['odyssey', 'ody'] },
]

/**
 * Detect platform from text
 * @param {string} text free-text content
 * @returns {string|null} platform identifier (pc, xb, ps) or null
 */
export function detectPlatform (text) {
  if (!text) {
    return null
  }
  const lower = text.toLowerCase()
  for (const { platform, words } of platformPatterns) {
    for (const word of words) {
      if (new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\b`, 'iu').test(lower)) {
        return platform
      }
    }
  }
  return null
}

/**
 * Detect expansion from text
 * @param {string} text free-text content
 * @returns {string|null} expansion identifier (horizons3, horizons4, odyssey) or null
 */
export function detectExpansion (text) {
  if (!text) {
    return null
  }
  const lower = text.toLowerCase()
  for (const { expansion, words } of expansionPatterns) {
    for (const word of words) {
      if (new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\b`, 'iu').test(lower)) {
        return expansion
      }
    }
  }
  return null
}
