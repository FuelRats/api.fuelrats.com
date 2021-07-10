// import Permission from './Permission'
import { URL } from 'url'
import { UnprocessableEntityAPIError } from '../classes/APIError'
import RegexLiteral from './RegexLiteral'


const forbiddenCMDRNameComponents = ['[pc]', '[xb]', '[ps]', 'CMDR']
const requiredQuoteFields = [
  'message',
  'author',
  'lastAuthor',
  'createdAt',
  'updatedAt',
]

export const IRCVirtualHost = /^[a-z][a-z0-9.]{3,64}$/u
export const IRCNickname = /^[A-Za-z_\\`\[\]{}]([A-Za-z0-9_\\`\[\]{}\-|]{1,29})?$/u
export const languageCode = /^[a-z]{2}-[A-Z]{2}$/u
export const stripeUserId = /cus_[A-Za-z0-9]{14}$/u


// language=JSUnicodeRegexp
export const FrontierRedeemCode = new RegexLiteral(`^
  [A-Z0-9]{5}-
  [A-Z0-9]{5}-
  [A-Z0-9]{5}-
  [A-Z0-9]{5}-
  (FUE|FRT)[0-9]{2}
$`, 'gu')

// noinspection RegExpRepeatedSpace
// language=JSUnicodeRegexp
export const CMDRname = new RegexLiteral(`^[
  \\p{Letter}
  \\p{Mark}
  \\p{Decimal_Number}
  \\p{Connector_Punctuation}
  \\p{Space_Separator}
  \\p{Paragraph_Separator}
  \\p{Dash_Punctuation}
  \\p{Other_Punctuation}
  |
]{3,64}$`, 'gui')
// language=JSUnicodeRegexp
export const ShipName = new RegexLiteral(`^[
  \\p{Letter}
  \\p{Mark}
  \\p{Decimal_Number}
  \\p{Connector_Punctuation}
  \\p{Space_Separator}
  \\p{Paragraph_Separator}
  \\p{Dash_Punctuation}
  \\p{Other_Punctuation}
  |
]{3,22}$`, 'gu')
// language=JSUnicodeRegexp
export const OAuthClientName = new RegexLiteral(`^[
  \\p{Letter}
  \\p{Mark}
  \\p{Decimal_Number}
  \\p{Connector_Punctuation}
  \\p{Space_Separator}
  \\p{Paragraph_Separator}
  \\p{Dash_Punctuation}
  \\p{Other_Punctuation}
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
 * Validate whether input is a valid CMDR name
 * @param {string} value input to validate
 */
export function validCMDRname (value) {
  if (CMDRname.test(value) === true) {
    const lowerNick = value.toLowerCase()
    const forbidden = forbiddenCMDRNameComponents.some((comp) => {
      return lowerNick.includes(comp)
    })

    if (!forbidden) {
      return
    }
  }

  throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/name' })
}

/**
 * Validate whether a value is a valid OAuth2 redirect URL
 * @param {string} urlString the value to validate
 * @returns {boolean}
 */
export function isValidRedirectUri (urlString) {
  if (typeof urlString !== 'string' || urlString.length === 0) {
    return false
  }

  let url = undefined
  try {
    url = new URL(urlString)
  } catch (ex) {
    return false
  }

  return (url.search.length === 0 && url.hash.length === 0)
}


/**
 * Validate whether a value is a valid JSON object for a jsonb field
 * @param {object} value the value to validate
 */
export function JSONObject (value) {
  if (typeof value !== 'object') {
    throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/data' })
  }
}


/**
 * Validate whether a value is a valid list of rescue quotes
 * @param {object} quotes the list of rescue quotes to validate
 */
export function RescueQuote (quotes) {
  try {
    quotes.forEach((quote) => {
      requiredQuoteFields.forEach((requiredField) => {
        if (Reflect.has(quote, requiredField) === false) {
          throw Error()
        }
      })
    })
  } catch (ex) {
    throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/quotes' })
  }
}

/**
 * Validate whether a value is a valid list of IRC nicknames
 * @param {[string] }value the list of IRC nicknames to validate
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
 * Validate whether a value is a valid URL
 * @param {string} value the URL to validate
 * @returns {URL} a url
 */
export function isURL (value) {
  try {
    return new URL(value)
  } catch (ex) {
    throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/redirectUri' })
  }
}
