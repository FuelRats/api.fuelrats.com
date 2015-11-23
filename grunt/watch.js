module.exports = {
  options: {
    spawn: true,
    interrupt: true
  },

  sass: {
    files: 'scss/**/*.scss',
    tasks: [
      'sass',
      'autoprefixer',
      'notify:sass'
    ]
  }
}
