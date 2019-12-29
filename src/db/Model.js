import Sequelize from 'sequelize'
export { DataTypes as type } from 'sequelize'

export default class Model extends Sequelize.Model {
  static init (sequelize) {
    return super.init(this.columns, {
      ...this.options,
      scopes: this.scopes,
      modelName: this.name,
      sequelize
    })
  }

  static associate (models) {
    const scopes = Object.entries(this.getScopes(models))
    scopes.forEach(([scope, [definition, options]]) => {
      this.addScope(scope, definition, options)
    })
  }

  static getScopes () {
    return {}
  }
}

export function table (options) {
  return function (target) {
    target.options = options
  }
}

export function column (type, { allowNull = false, ...options } = {}) {
  return function (target, name) {
    const columnName = options.name || name
    target.columns = target.columns || {}
    target.columns[columnName] = {
      type,
      allowNull,
      ...options,
      defaultValue: target[columnName]
    }
  }
}

export function validate (validations, options = {}) {
  return function (target, name) {
    const columnName = options.name || name
    if (Reflect.has(target.columns, columnName) === false) {
      throw new TypeError('Attempted to validate a field that has not been declared as a column')
    }

    target.columns[columnName].validate = validations
  }
}
