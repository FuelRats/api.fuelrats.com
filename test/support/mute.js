'use strict'

// remember where we parked
const _stdout = process.stdout.write
const _stderr = process.stdout.write
const boutwrite = process.stdout.write.bind(process.stdout)
const berrwrite = process.stderr.write.bind(process.stderr)

/**
 * 
 */
function NOOP () {
  // do nothing
}

/**
 * 
 */
function mute () {
  if (process.stdout.write !== NOOP) {
    process.stdout.write = NOOP
  }
  if (process.stderr.write !== NOOP) {
    process.stderr.write = NOOP
  }
}

/**
 * 
 */
function unmute () {
  if (process.stdout.write === NOOP) {
    process.stdout.write = _stdout
  }
  if (process.stderr.write === NOOP) {
    process.stderr.write = _stderr
  }
}

/**
 * 
 * @param {*} msg 
 */
function log (msg) {
  boutwrite(msg + '\n', 'utf8')
}

/**
 * 
 * @param {*} msg 
 */
function error (msg) {
  berrwrite(msg + '\n', 'utf8')
}

module.exports = {
  mute, unmute, log, error
}