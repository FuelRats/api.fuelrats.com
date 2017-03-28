'use strict'
let config = require('../../config.json')
let https = config.proxyHasSSL === true ? require('https') : require('http')

/**
 * Symbol representing HTTP GET method requests
 * @type {Symbol}
 */
const GET = Symbol()

/**
 * Symbol representing HTTP POST method requests
 * @type {Symbol}
 */
const POST = Symbol()

/**
 * Class for sending test requests to the API
 * @class
 */
class APITest {
  /**
   * Create a new instance of a test request to the API
   * @param requestType Either a GET or POST symbol for the type of request
   * @param options Override options in https module format
   * @param data Object to send in HTTP post request
   * @returns {Promise} A javascript promise for the request
   */
  constructor (requestType, options, data = null) {
    switch (requestType) {
      case GET:
        return APITest._httpGetRequest(options)

      case POST:
        return APITest._httpPostRequest(options, data)

      default:
        return null
    }
  }

  /**
   * Make a HTTP GET request
   * @param overrideOptions Override options in https module format
   * @returns {Promise} A javascript promise for the request
   * @private
   */
  static _httpGetRequest (overrideOptions) {
    return new Promise(function (resolve) {
      let options = {
        host: config.hostname,
        path: '',
        port: 8080
      }

      Object.assign(options, overrideOptions)

      https.get(options, function (response) {
        let body = ''

        response.on('data', function (data) {
          body += data
        })

        response.on('end', function () {
          resolve({
            response,
            body: JSON.parse(body)
          })
        })
      })
    })
  }

  /**
   * Make a HTTP POST request
   * @param overrideOptions Override options in https module format
   * @param data Object to send HTTP post request
   * @returns {Promise} A javascript promise for the request
   * @private
   */
  static _httpPostRequest (overrideOptions, data = null) {
    let textBody = JSON.stringify(data)

    return new Promise(function (resolve) {
      let options = {
        host: config.hostname,
        port: 8080,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Size': Buffer.byteLength(textBody)
        }
      }

      Object.assign(options, overrideOptions)


      let post = https.request(options, function (response) {
        response.setEncoding('utf8')
        let body = ''

        response.on('data', function (data) {
          body += data
        })

        response.on('end', function () {
          try {
            let jsonBody = JSON.parse(body)
            resolve({
              response,
              body: jsonBody
            })
          } catch (ex) {
            resolve({
              response,
              body
            })
          }
        })
      })

      post.write(textBody)
      post.end()
    })
  }
}

module.exports = {
  GET,
  POST,
  APITest
}