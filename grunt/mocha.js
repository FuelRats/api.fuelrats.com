module.exports = {
  options: {
    mocha: {
      ignoreLeaks: false
    },
    run: true
  },

  test: {
    options: {
      reporter: 'Spec'
    },
    src: 'test/index.html'
  }
}
