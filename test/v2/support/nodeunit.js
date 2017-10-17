'use strict'

/**
 * wrapper for nodeunit to remove boilerplate try/catch
 */
module.exports.asyncWrap = function (f) {

  return async function (test) {

    try {
      await f(test)
    } catch (err) {
      test.ifError(err)
    }

    test.done()

  }



}