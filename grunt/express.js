'use strict'
const config = require('../config')


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
