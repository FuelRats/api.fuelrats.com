'use strict'
const Error = require('../errors')
const db = require('../db').db


class API {
  static compare (table, comparators) {
    let statements = []
    for (let comparator of comparators) {
      for (let option of comparator.options) {
        let [value, value2, name] = option
        name = name || (value2 ? value + value2 : value)
        if (typeof value === 'string') {
          value = `'${value}'`
        }

        if (value2 && typeof value2 === 'string') {
          value2 = `'${value2}'`
        }

        if (value2) {
          statements.push([db.fn('SUM',
            db.literal(
              `CASE WHEN "${table}"."${comparator.fields[0]}" = ${value} 
              AND "${table}"."${comparator.fields[1]}" = ${value2} THEN 1 ELSE 0 END`)), name])
        } else {
          statements.push([db.fn('SUM',
            db.literal(`CASE WHEN "${table}"."${comparator.fields[0]}" = ${value} THEN 1 ELSE 0 END`)), name])
        }
      }
    }
    return statements
  }

  static getComparator (comparators, field) {
    for (let comparator of comparators) {
      for (let option of comparator.options) {
        let [value, value2, name] = option
        name = name || (value2 ? value + value2 : value)
        if (typeof value === 'string') {
          value = `'${value}'`
        }

        if (value2 && typeof value2 === 'string') {
          value2 = `'${value2}'`
        }

        if (name === field) {
          if (value2) {
            return db.fn('SUM',
              db.literal(`CASE WHEN "${comparator.fields[0]}" = ${value} AND "${comparator.fields[1]}" = ${value2} THEN 1 ELSE 0 END`))
          } else {
            return db.fn('SUM',
              db.literal(`CASE WHEN "${comparator.fields[0]}" = ${value} THEN 1 ELSE 0 END`))
          }
        }
      }
    }
    return null
  }
}

module.exports = API
