var gitrev

git = require('git-rev')

exports.get = function (request, response) {
  var responseModel

  responseModel = {
    links: {
      self: request.originalUrl
    }
  }

  git.long(function (githash) {
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
