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
  },

  coverage: {
    options: {
      captureFile: './doc/coverage.html',
      reporter: 'HTMLCov'
    },
    src: 'test/index.html',
    dest: './doc/coverage.html'
  }
}
