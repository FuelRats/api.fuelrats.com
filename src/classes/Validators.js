import Permission from './Permission'
import RegexLiteral from './RegexLiteral'
import { UnprocessableEntityAPIError } from './APIError'
import { URL } from 'url'

export const IRCVirtualHost = /^[a-z][a-z0-9.]{3,64}$/u
export const IRCNickname = /^[A-Za-z_\\`\[\]{}]([A-Za-z0-9_\\`\[\]{}]{1,29})?$/u
const forbiddenCMDRNameComponents = ['[pc]', '[xb]', '[ps]']

// language=JSUnicodeRegexp
export const FrontierRedeemCode = new RegexLiteral(`^
  [A-Z0-9]{5}-
  [A-Z0-9]{5}-
  [A-Z0-9]{5}-
  [A-Z0-9]{5}-
  FUE[0-9]{2}
$`, 'gu')

// noinspection RegExpRepeatedSpace
// language=JSUnicodeRegexp
export const CMDRname = new RegexLiteral(`^[
  \\p{Alphabetic}
  \\p{Mark}
  \\p{Decimal_Number}
  \\p{Connector_Punctuation}
  \\p{Join_Control}
  \\p{Space_Separator}
]{3,64}$`, 'gui')
// language=JSUnicodeRegexp
export const ShipName = new RegexLiteral(`^[
  \\p{Alphabetic}
  \\p{Mark}
  \\p{Decimal_Number}
  \\p{Connector_Punctuation}
  \\p{Join_Control}
  \\p{Space_Separator}
]{3,22}$`, 'gu')
// language=JSUnicodeRegexp
export const OAuthClientName = new RegexLiteral(`^[
  \\p{Alphabetic}
  \\p{Mark}
  \\p{Decimal_Number}
  \\p{Connector_Punctuation}
  \\p{Join_Control}
  \\p{Punctuation}
  \\p{Space_Separator}
]{3,64}$`, 'gu')
// language=JSUnicodeRegexp
export const UUID = new RegexLiteral(`^
  [0-9a-f]{8}-
  [0-9a-f]{4}-
  [1-5][0-9a-f]{3}-
  [89ab][0-9a-f]{3}-
  [0-9a-f]{12}
`, 'igu')

/**
 * Validate wether a list of OAuth Scopes is valid
 * @param value the list of OAuth scopes to validate
 * @constructor
 */
export function OAuthScope (value) {
  for (const scope of value) {
    if (Permission.allPermissions.includes(scope) === false && scope !== '*') {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/scope' })
    }
  }
}

export function validCMDRname (value) {
  if (CMDRname.test(value) === true) {
    const lowerNick = value.toLowerCase()
    let invalid = forbiddenCMDRNameComponents.some((comp) => {
      return lowerNick.includes(comp)
    })

    if (invalid === false) {
      return true
    }
  }

  throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/name' })
}

/**
 * Validate wether a value is a valid JSON object for a jsonb field
 * @param value the value to validate
 * @constructor
 */
export function JSONObject (value) {
  if (typeof value !== 'object') {
    throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/data' })
  }
}

const requiredQuoteFields = [
  'message',
  'author',
  'lastAuthor',
  'createdAt',
  'updatedAt'
]

/**
 * Validate wether a value is a valid list of rescue quotes
 * @param quotes the list of rescue quotes to validate
 * @constructor
 */
export function RescueQuote (quotes) {
  try {
    quotes.forEach((quote) => {
      requiredQuoteFields.forEach((requiredField) => {
        if (quote.hasOwnProperty(requiredField) === false) {
          throw Error()
        }
      })

      for (const [key, value] of Object.entries(quote)) {
        switch (key) {
          case 'message':
            if (typeof value !== 'string') {
              throw Error()
            }
            break

          case 'author':
          case 'lastAuthor':
            if ((typeof value !== 'undefined') && typeof value !== 'string') {
              throw Error()
            }
            break

          case 'createdAt':
          case 'updatedAt':
            if ((typeof value !== 'undefined') && ISO8601.test(value) === false) {
              throw Error()
            }
            break

          default:
            throw Error()
        }
      }
    })
  } catch (ex) {
    throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/quotes' })
  }
}

/**
 * Validate wether a value is a valid list of IRC nicknames
 * @param value the list of IRC nicknames to validate
 * @constructor
 */
export function IRCNicknames (value) {
  if (!Array.isArray(value)) {
    throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/nicknames' })
  }
  value.forEach((nickname) => {
    if (!IRCNickname.test(nickname)) {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/nicknames' })
    }
  })
}

/**
 * Validate wether a value is a valid URL
 * @param value the URL to validate
 * @constructor
 */
export function isURL (value) {
  try {
    return new URL(value)
  } catch (ex) {
    throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/redirectUri' })
  }
}
