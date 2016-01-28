var winston,
winston = require( 'winston' )

exports.get = function (request, response) {
  response.render('docs', function (err, html) {
    if ( err ) {
      winston.error(err)
      response.send('Unable to find documentation. Please consult the included README')
    } else {
      response.send(html)
    }
  })
}
