'use strict'

const { promisify } = require('util')
const { join } = require('path')

// we want to explicity run the test in order of complexity
// not their alphabetical order 
const tests = ['login.js', 'rescue.js', 'stats.js']

/**
 * run against all the files/dirs defined in tests
 * @returns {Promise.<void>}
 */
async function start () {

  const reporter = require('nodeunit').reporters.default
  const run = promisify(reporter.run)
  await run(tests.map((test) => join(__dirname, test)), undefined)
  process.exit(0)

}

start()