module.exports = {
  production: {
    options: {
      shorthandCompacting: false,
      roundingPrecision: -1
    },
    files: {
      'static/style.min.css': ['static/*.css', '!static/*.min.css']
    }
  }
}
