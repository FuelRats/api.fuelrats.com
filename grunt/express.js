'use strict'
var config, fs

fs = require('fs')

// Import config
if (fs.existsSync('config.js')) {
  config = require('../config')
} else {
  config = require('../config-example')
}

module.exports = {
  dev: {
    options: {
      port: config.port,
      script: 'index.js',
      output: '(Listening for requests on port)',
      node_env: 'dev'
    }
  },

  test: {
    options: {
      port: config.port,
      script: 'index.js',
      output: '(Listening for requests on port)',
      node_env: 'testing'
    }
  }
}
