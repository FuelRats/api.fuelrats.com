module.exports = {
  options: {
    presets: ['es2015'],
    sourceMap: true
  },
  dist: {
    files: {
      'static/app.js': 'src/app.js'
    }
  }
}
