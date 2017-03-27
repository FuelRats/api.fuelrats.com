'use strict'
let Sequelize = require('sequelize')
let _ = require('underscore')

function CITEXT () {
  if (!(this instanceof CITEXT)) {
    return new CITEXT()
  }
}
_.extend(CITEXT, Sequelize.ABSTRACT)

CITEXT.prototype.key = CITEXT.key = 'CITEXT'
CITEXT.prototype.toSql = function toSql () {
  return this.key
}

CITEXT.prototype.validate = function validate (value) {
  if (!_.isString(value)) {
    return false
  }

  return true
}

module.exports = CITEXT