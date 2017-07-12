'use strict'
const Error = require('../errors')
const db = require('../db').db


class API {
  static compare (comparators) {
    let statements = []
    for (let comparator of comparators) {
      for (let option of comparator.options) {
        let [value, name] = option
        name = name || value
        if (typeof value === 'string') {
          value = `'${value}'`
        }
        statements.push()
        statements.push([db.fn('SUM',
          db.literal(`CASE WHEN "Rescue"."${comparator.field}" = ${value} THEN 1 ELSE 0 END`)), name])
      }
    }
    return statements
  }

  static getComparator (comparators, field) {
    for (let comparator of comparators) {
      for (let option of comparator.options) {
        let [value, name] = option
        name = name || value
        if (typeof value === 'string') {
          value = `'${value}'`
        }
        if (name === field) {
          return db.fn('SUM',
            db.literal(`CASE WHEN "${comparator.field}" = ${value} THEN 1 ELSE 0 END`))
        }
      }
    }
    return null
  }
}

module.exports = API
