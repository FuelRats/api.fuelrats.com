'use strict'

process.env.NODE_ENV = 'testing'

const { promisify } = require('util')

const tests = ['v2']

/**
 * run against all the files/dirs defined in tests
 * @returns {Promise.<void>}
 */
async function start () {

  const reporter = require('nodeunit').reporters.default
  const run = promisify(reporter.run)
  await run(tests.map((test) => 'test/' + test), undefined)
  process.exit(0)

}

start()