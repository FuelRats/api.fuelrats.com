var gitrev

gitrev = require('git-rev')

exports.get = function (request, response) {
  var responseModel

  responseModel = {
    links: {
      self: request.originalUrl
    }
  }

  gitrev.long(function (githash) {
    var status, serverVersion

    serverVersion = process.env.npm_package_version

    responseModel.data = {
      version: serverVersion,
      commit: githash
    }

    status = 200
    response.status(status)
    response.json(responseModel)
  })
}
