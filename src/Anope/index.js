import {
  ConflictAPIError, NotFoundAPIError, UnauthorizedAPIError,
  UnprocessableEntityAPIError, APIError, ForbiddenAPIError
} from '../classes/APIError'
import { XmlEntities as Entities } from 'html-entities'

let config = require('../../config')

import xmlrpc from 'homematic-xmlrpc'

const anopeXMLRPCUrl = config.xmlrpc.url

let client = null
if (config.xmlrpc.insecure) {
  client = xmlrpc.createClient(anopeXMLRPCUrl)
} else {
  client = xmlrpc.createSecureClient(anopeXMLRPCUrl)
}

/**
 * Anope XMLRPC connection client
 * @class
 */
export default class Anope {
  /**
   * Send an Anope formatted XMLRPC command
   * @param service The Anope service to interact with, e.g NickServ
   * @param user The user you are representing in this command
   * @param command The command to send to the anope service
   * @returns {Promise}
   */
  static command (service, user, command) {
    service = Entities.encode(service)
    user = Entities.encode(user)
    command = Entities.encode(command)
    return new Promise(function (resolve, reject) {
      client.methodCall('command', [[service, user, command]], function (error, data) {
        if (error) {
          return reject(error)
        } else {
          let response = new AnopeResponse(data)
          if (response instanceof APIError) {
            return reject(response)
          }
          return resolve(response)
        }
      })
    })
  }

  /**
   * Send an Anope XMLRPC request for verifying user credentials
   * @param nickname The nickname to verify the password of
   * @param password The password to verify
   * @returns {Promise}
   */
  static checkAuthentication (nickname, password) {
    nickname = Entities.encodeNonUTF(nickname)
    password = Entities.encodeNonUTF(password)
    return new Promise(function (resolve, reject) {
      client.methodCall('checkAuthentication', [[nickname, password]], function (error, data) {
        if (error) {
          reject(error)
        } else {
          if (data.result === 'Success' && data.account !== null) {
            resolve(data.account)
          } else {
            reject(data)
          }
        }
      })
    })
  }
}

export class AnopeResponse {
  constructor (result) {
    let [, translation] = Object.entries(responseTranslations).find(([key,]) => {
      let response = result.return || result.error
      return new RegExp(key, 'gi').test(response)
    }) || []
    if (!translation) {
      translation = result
    }
    return translation
  }
}

const responseTranslations = {
  'isn&#39;t registered': new NotFoundAPIError({ pointer: '/data/attributes/nickname' }),
  'Password authentication required': new UnauthorizedAPIError({ pointer: '/data/attributes/password' }),
  'more obscure password': new UnprocessableEntityAPIError({ pointer: '/data/attributes/password' }),
  'password is too long': new UnprocessableEntityAPIError({ pointer: '/data/attributes/password' }),
  'may not be registered': new UnprocessableEntityAPIError({ pointer: '/data/attributes/nickname' }),
  'is already registered': new ConflictAPIError({ pointer: '/data/attributes/nickname' }),
  'may not drop other Services Operator': new ForbiddenAPIError({ pointer: '/data/attributes/nickname' }),
  'Invalid parameters': new UnprocessableEntityAPIError({})
}