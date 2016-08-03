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

  frontendJS: {
    files: ['src/**/*.js']
  },
  options: {
    spawn: false
  },
  tasks: [
    'babel'
  ]
}
