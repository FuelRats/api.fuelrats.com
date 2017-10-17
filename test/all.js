'use strict'

process.env.NODE_ENV = 'testing'

const { promisify } = require('util')

const tests = ['v2']

async function start () {

  const reporter = require('nodeunit').reporters.default
  const run = promisify(reporter.run)
  await run(tests.map((t) => 'test/' + t), undefined)
  process.exit(0)

}

start()