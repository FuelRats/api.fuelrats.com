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
    src: 'test/test.html'
  },

  coverage: {
    options: {
      reporter: 'HTMLCov'
    },
    src: 'test/test.html',
    dest: './doc/coverage.html'
  }
}
