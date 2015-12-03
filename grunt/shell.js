module.exports = {
  mongo: {
    command: './bin/mongo.sh',
    options: {
      async: true
    }
  },

  api: {
    command: './node_modules/node-dev/bin/node-dev api.js'
  },

  apiNoLog: {
    command: './node_modules/node-dev/bin/node-dev api.js --no-log'
  }
}
