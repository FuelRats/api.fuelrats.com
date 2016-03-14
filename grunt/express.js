var config, fs

fs = require( 'fs' )

// Import config
if ( fs.existsSync( '../config.json' ) ) {
  config = require( '../config' )
} else {
  config = require( '../config-example' )
}

module.exports = {
  dev: {
    options: {
      port: config.port,
      script: 'index.js',
      output: '(Listening for requests on port)'
    }
  }
}
