'use strict'
const fs = require('fs')
const { promisify } = require('util')
const { join } = require('path')

// we want to explicity run the test in order of complexity
// not their alphabetical order 
const defaultTests = ['login', 'user', 'rat', 'rescue', 'stats']

const bwrite = process.stderr.write.bind(process.stderr)

const START_OF_ARGS = 2
const args = (process.ARGV || process.argv).slice(START_OF_ARGS)

const options = {
  error_prefix: '\u001B[31m',
  error_suffix: '\u001B[39m',
  ok_prefix: '\u001B[32m',
  ok_suffix: '\u001B[39m',
  bold_prefix: '\u001B[1m',
  bold_suffix: '\u001B[22m',
  assertion_prefix: '\u001B[35m',
  assertion_suffix: '\u001B[39m',
  mute: true
}

/**
 * run against all the files/dirs defined in tests
 * @returns {Promise.<void>}
 */
async function start () {

  try {

    let tests

    if (args.length) {
      // must have specified a specific test
      tests = [ args.shift() ]
      options.testspec = args.shift()
    } else {
      // just run the default tests
      tests = defaultTests
    }

    const reporter = require('./support/reporter')
    const run = promisify(reporter.run)
    await run(tests.map((test) => {
      // check if the files exist
      const file = join(__dirname, test + '.js')
      if (fs.existsSync(file)) {
        return file
      }
      throw Error('cannot find test file: ' + file)
    }), options)
  } catch (err) {
    // just in case we have failed to restore stderr
    bwrite(err + '\n', 'utf8')
  }

  process.exit(0)

}

start()