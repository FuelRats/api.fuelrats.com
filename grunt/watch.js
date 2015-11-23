module.exports = {
  options: {
    spawn: true,
    interrupt: true
  },

  test: {
    files: 'test/spec/*.js',
    tasks: [
      'browserify'
    ]
  }
}
