'use strict'
/**
 * bespoke nodeunit reporter based on nodeunit/lib/reporters/dafault.js
 */
const nodeunit = require('nodeunit')
const utils = require('nodeunit/lib/utils')
const fs = require('fs')
const track = require('nodeunit/lib/track')
const path = require('path')
const { AssertionError } = require('nodeunit/lib/assert')

/**
 * Reporter info string
 */

exports.info = 'FuelRats tests reporter'

// override console.log to prevent any output other than from nodeunit
const { log } = console
const NOOP = function () {}
const override = ['log', 'warn', 'error', 'debug']
override.forEach((func) => { console[func] = NOOP }) // eslint-disable-line no-console

/**
 * Run all tests within each module, reporting the results to the command-line.
 *
 * @param {Array} files
 * @api public
 */

exports.run = function (files, options, callback) {

  if (!options) {
    // load default options
    const content = fs.readFileSync(
        __dirname + '/nodeunit-default.json', 'utf8'
    )
    options = JSON.parse(content)
  }

  const error = function (str) {
    return options.error_prefix + str + options.error_suffix
  }
  const ok    = function (str) {
    return options.ok_prefix + str + options.ok_suffix
  }
  const bold  = function (str) {
    return options.bold_prefix + str + options.bold_suffix
  }
  const assertion_message = function (str) {
    return options.assertion_prefix + str + options.assertion_suffix
  }
  const pass_indicator = process.platform === 'win32' ? '\u221A' : '✔'
  const fail_indicator = process.platform === 'win32' ? '\u00D7' : '✖'

  // const start = new Date().getTime()
  const tracker = track.createTracker(function (tracker) {
    if (tracker.unfinished()) {
      log('')
      log(error(bold(
          'FAILURES: Undone tests (or their setups/teardowns): '
      )))
      const names = tracker.names()
      for (let name of names) {
        log(' - ' + name)
      }
      log('')
      log('To fix this, make sure all tests call test.done()')
      process.reallyExit(tracker.unfinished())
    }
  })

  const opts = {
    testspec: options.testspec,
    testFullSpec: options.testFullSpec,
    recursive: options.recursive,
    moduleStart: function (name) {
      log('\n' + bold(name))
    },
    testDone: function (name, assertions) {
      tracker.remove(name)

      if (!assertions.failures()) {
        log(pass_indicator + ' ' + name)
      }
      else {
        log(error(fail_indicator + ' ' + name) + '\n')
        assertions.forEach(function (assertion) {
          if (assertion.failed()) {
            assertion = utils.betterErrors(assertion)
            if (assertion.error instanceof AssertionError && assertion.message) {
              log(
                'Assertion Message: ' +
                assertion_message(assertion.message)
              )
            }
            log(assertion.error.stack + '\n')
          }
        })
      }
    },
    done: function (assertions) {
      // end = end || new Date().getTime()
      // const duration = end - start
      if (assertions.failures()) {
        log(
          '\n' + bold(error('FAILURES: ')) + assertions.failures() +
          '/' + assertions.length + ' assertions failed (' +
          assertions.duration + 'ms)'
        )
      }
      else {
        log(
          '\n' + bold(ok('OK: ')) + assertions.length +
          ' assertions (' + assertions.duration + 'ms)'
        )
      }

      if (callback) {
        callback(assertions.failures() ? new Error('We have got test failures.') : undefined)
      }
    },
    testStart: function (name) {
      tracker.put(name)
    }
  }
  if (files && files.length) {
    const paths = files.map(function (filePath) {
      return path.resolve(filePath)
    })
    nodeunit.runFiles(paths, opts)
  } else {
    nodeunit.runModules(files, opts)
  }
}
