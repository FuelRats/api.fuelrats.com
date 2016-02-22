var gitrev

gitrev = require('git-rev')

exports.get = function (request, response) {
  exports.view( request.body ).then( function( data, meta ) {
    status = 200
    response.status(status)
    response.json(data)
  })
}

exports.view = function ( query ) {
  return new Promise(function (resolve, reject) {
    var responseModel

    gitrev.long(function (githash) {
      var status, serverVersion

      serverVersion = process.env.npm_package_version

      var data = {
        version: serverVersion,
        commit: githash
      }

      resolve({ data: data, meta: {} })
    })
  })
}
