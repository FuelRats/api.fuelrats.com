module.exports = {
  express: {
    files: [
      'index.js',
      'api/**/*.js'
    ],
    options: {
      spawn: false
    },
    tasks: [ 'express:dev' ]
  }
}
