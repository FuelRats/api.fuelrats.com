module.exports = {
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
  },

  'expresstest': {
    files: [
      'index.js',
      'api/**/*.js'
    ],
    options: {
      spawn: false
    },
    tasks: [
      'express:test'
    ]
  },

  frontendJS: {
    files: ['src/**/*.js'],
    tasks: [
      'buildJS'
    ]
  },
}
