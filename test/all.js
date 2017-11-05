'use strict'

const { promisify } = require('util')
const { join } = require('path')

// we want to explicity run the test in order of complexity
// not their alphabetical order 
const tests = ['login.js', 'user.js', 'rat.js', 'rescue.js', 'stats.js']

const { error } = console

/**
 * run against all the files/dirs defined in tests
 * @returns {Promise.<void>}
 */
async function start () {

  try {
    const reporter = require('./support/reporter')
    const run = promisify(reporter.run)
    await run(tests.map((test) => join(__dirname, test)), undefined)
  } catch (err) {
    error(err)
  }

  process.exit(0)

}

start()