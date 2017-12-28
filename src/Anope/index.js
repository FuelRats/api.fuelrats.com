
let config = require('../../../config')

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
class Anope {
  /**
   * Send an Anope formatted XMLRPC command
   * @param service The Anope service to interact with, e.g NickServ
   * @param user The user you are representing in this command
   * @param command The command to send to the anope service
   * @returns {Promise}
   */
  static command (service, user, command) {
    return new Promise(function (resolve, reject) {
      client.methodCall('command', [[service, user, command]], function (error, data) {
        if (error) {
          reject(error)
        } else {
          resolve(data)
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

module.exports = Anope
