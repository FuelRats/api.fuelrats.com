'use strict'

/**
 * wrapper for nodeunit to remove boilerplate try/catch
 */
module.exports.asyncWrap = function (func) {

  return async function (test) {

    try {
      await func(test)
    } catch (err) {
      test.ifError(err)
    }

    test.done()

  }



}