module.exports = {
  docs: {
    files: [
      'docs/**/*.apib'
    ],
    tasks: [
      'docs'
    ]
  },

  express: {
    files: [
      'index.js',
      'api/**/*.js'
    ],
    options: {
      spawn: false
    },
    tasks: [
      'express:dev'
    ]
  }
}
