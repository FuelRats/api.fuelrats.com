'use strict'
const gitrev = require('git-rev')

exports.get = function (request, response) {
  exports.view(request.body).then(function (data) {
    status = 200
    response.status(status)
    response.json(data)
  })
}

exports.view = function () {
  return new Promise(function (resolve) {
    gitrev.long(function (githash) {
      let serverVersion = process.env.npm_package_version

      let data = {
        version: serverVersion,
        commit: githash
      }

      resolve({
        data: data,
        meta: {}
      })
    })
  })
}
