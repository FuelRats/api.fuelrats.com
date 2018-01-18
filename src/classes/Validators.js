import Permission from './Permission'
import {UnprocessableEntityAPIError} from './APIError'

export const FrontierRedeemCode = /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-FUE[0-9]{2}$/
export const IRCVirtualHost = /^[a-z][a-z0-9.]{3,64}$/
export const CMDRname = /^[\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Connector_Punctuation}\p{Join_Control} ]{3,64}$/u
export const ShipName = /^[\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Connector_Punctuation}\p{Join_Control} ]{3,22}$/u
export const ISO8601 = /^([\+-]?\d{4}(?!\d{2}\b))((-?)((0[1-9]|1[0-2])(\3([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))([T\s]((([01]\d|2[0-3])((:?)[0-5]\d)?|24\:?00)([\.,]\d+(?!:))?)?(\17[0-5]\d([\.,]\d+)?)?([zZ]|([\+-])([01]\d|2[0-3]):?([0-5]\d)?))?)?$/

/**
 * Validate wether a list of OAuth Scopes is valid
 * @param value the list of OAuth scopes to validate
 * @constructor
 */
export function OAuthScope (value) {
  for (let scope of value) {
    if (Permission.allPermissions.includes(scope) === false && scope !== '*') {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/scope' })
    }
  }
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
  'createdAt',
  'updatedAt'
]

/**
 *
 * @param value
 * @constructor
 */
export function RescueQuote (value) {
  try {
    value.forEach(quote => {
      quote = JSON.parse(quote)
      requiredQuoteFields.forEach(requiredField => {
        if (quote.hasOwnProperty(requiredField) === false) {
          throw Error()
        }
      })

      Object.entries(quote).forEach(([key, value]) => {
        switch (key) {
          case 'message':
            if (typeof value !== 'string') {
              throw Error()
            }
            break

          case 'author':
            if (value !== null && typeof value !== 'string') {
              throw Error()
            }
            break

          case 'createdAt':
          case 'updatedAt':
            if (value !== null && ISO8601.test(value) === false) {
              throw Error()
            }
            break

          default:
            throw Error()
        }
      })
    })
  } catch (ex) {
    throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/quotes' })
  }
}