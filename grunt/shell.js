module.exports = {
  mongo: {
    command: './bin/mongo.sh',
    options: {
      async: true
    }
  },

  api: {
    command: './node_modules/node-dev/bin/node-dev ./index.js'
  }
};
