import knex from 'knex'
import config from '../../config'

const { database, username, password, hostname, port } = config.postgres

const db = knex({
  client: 'pg',
  connection: {
    host: hostname,
    port,
    user: username,
    password,
    database
  }
})

/**
 * @abstract
 */
export default class Model {
  static db = db

  static select (tables) {
    return Model.db.select(Object.entries(tables).reduce((output, [table, columns]) => {
      output.push(...columns.map((col) => {
        return `${table}.${col} as ${table}.${col}`
      }))

      output.push(`${table}.createdAt`)
      output.push(`${table}.updatedAt`)
      return output
    }, []))
  }

  static find () {

  }

  static findAll () {

  }

  insert () {

  }

  save () {

  }
}

export function column ({ type, defaultValue, ...options }) {
  return function (prototype, name, descriptor) {
    Object.defineProperty(prototype, name, {
      writable: true,
      value: (new ColumnDescription({ type, defaultValue, ...options }))
    })
  }
}

export function validate (...validators) {
  return function (prototype, name, descriptor) {
    descriptor.value.validators = validators
  }
}

export const paranoid = 'deletedAt'

class ColumnDescription  {
  type = undefined
  defaultValue = undefined
  options = undefined
  validators = []

  constructor ({ type, defaultValue, ...options }) {
    this.type = type
    this.defaultValue = defaultValue
    this.options = options
  }
}
