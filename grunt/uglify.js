module.exports = {
  production: {
    options: {
      mangle: false
    },
    files: {
      'static/script.min.js': ['static/*.js', '!static/*.min.js']
    }
  }
}
