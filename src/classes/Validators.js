import Permission from './Permission'
import {UnprocessableEntityAPIError} from './APIError'

export const FrontierRedeemCode = /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-FUE[0-9]{2}$/
export const IRCVirtualHost = /^[a-z][a-z0-9.]{3,64}$/
export const CMDRname = /^[\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Connector_Punctuation}\p{Join_Control} ]{3,64}$/u
export const ShipName = /^[\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Connector_Punctuation}\p{Join_Control} ]{3,22}$/u

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