'use strict'
const config = require('../../config')
const https = require('https')
const http = require('http')
const deepAssign = require('deep-assign')

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
 * Symbol representing HTTP PUT method requests
 * @type {Symbol}
 */
const PUT = Symbol()

/**
 * Class for sending test requests to the API
 * @class
 */
class Request {
  /**
   * Create a new instance of an http request
   * @param requestType Either a GET or POST symbol for the type of request
   * @param options Override options in https module format
   * @param data Object to send in HTTP post request
   * @returns {Promise} A javascript promise for the request
   */
  constructor (requestType, options, data = null) {
    switch (requestType) {
      case GET:
        return Request._httpGetRequest(options)

      case POST:
        return Request._httpPostRequest(options, data)

      case PUT:
        return Request._httpPutRequest(options, data)

      default:
        return null
    }
  }

  static async login (email, password) {
    let post = await new Request(POST, {
      path: '/login',
      insecure: true
    }, { email, password })

    return post.response.headers['set-cookie'].join(';')
  }

  /**
   * Make a HTTP GET request
   * @param overrideOptions Override options in https module format
   * @returns {Promise} A javascript promise for the request
   * @private
   */
  static _httpGetRequest (overrideOptions) {
    let httpEngine = https
    if (overrideOptions.insecure) {
      delete overrideOptions.insecure
      httpEngine = http
    }

    return new Promise(function (resolve) {
      let options = {
        host: config.hostname,
        path: '',
        port: config.port
      }

      deepAssign(options, overrideOptions)

      httpEngine.get(options, function (response) {
        let body = ''

        response.on('data', function (data) {
          body += data
        })

        response.on('end', function () {
          resolve({
            response,
            // only try to parse the body if we actually recieved
            // something to parse, otherwise let it though verbatim
            body: body ? JSON.parse(body) : body
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
    let httpEngine = https
    if (overrideOptions.insecure) {
      delete overrideOptions.insecure
      httpEngine = http
    }

    let textBody = JSON.stringify(data)

    return new Promise(function (resolve) {
      let options = {
        host: config.hostname,
        port: config.port,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Size': Buffer.byteLength(textBody)
        }
      }

      deepAssign(options, overrideOptions)


      let post = httpEngine.request(options, function (response) {
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
  /**
   * Make a HTTP PUT request
   * @param overrideOptions Override options in https module format
   * @param data Object to send HTTP put request
   * @returns {Promise} A javascript promise for the request
   * @private
   */
  static _httpPutRequest (overrideOptions, data = null) {
    let httpEngine = https
    if (overrideOptions.insecure) {
      delete overrideOptions.insecure
      httpEngine = http
    }

    let textBody = JSON.stringify(data)

    return new Promise(function (resolve) {
      let options = {
        host: config.hostname,
        port: config.port,
        path: '/',
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Size': Buffer.byteLength(textBody)
        }
      }

      deepAssign(options, overrideOptions)


      let put = httpEngine.request(options, function (response) {
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

      put.write(textBody)
      put.end()
    })
  }

}

module.exports = {
  GET,
  POST,
  PUT,
  Request
}