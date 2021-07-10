import Sequelize from 'sequelize'

export const type = Sequelize.DataTypes

/**
 * Base class for decorated database models
 */
export default class Model extends Sequelize.Model {
  /**
   * Initialise the database model
   * @param {Sequelize} sequelize sequelize instance
   * @returns {void}
   *
   */
  static init (sequelize) {
    return super.init(this.columns, {
      ...this.options,
      scopes: this.scopes,
      modelName: this.name,
      sequelize,
    })
  }

  /**
   * Base function for running associations on a model, associating it to other models and setting up scopes
   * @param {[Sequelize.Model]} models list of database models
   */
  static associate (models) {
    const scopes = Object.entries(this.getScopes(models))
    scopes.forEach(([scope, [definition, options]]) => {
      this.addScope(scope, definition, options)
    })
  }

  /**
   * Get all the scopes defined for this model
   * @returns {object} scope definition
   */
  static getScopes () {
    return {}
  }
}

/**
 * Decorator for defining the settings of a database table
 * @param {object} options table options
 * @returns {Function} decorator
 */
export function table (options) {
  return (target) => {
    target.options = options
  }
}

/**
 * Decorator for defining a database table column
 * @param {Sequelize.DataTypes} columnType the data type of the column
 * @param {boolean} [allowNull] allow this column to have null values
 * @returns {Function} decorator
 */
export function column (columnType, { allowNull = false, ...options } = {}) {
  return (target, name) => {
    const columnName = options.name ?? name
    target.columns = target.columns ?? {}
    target.columns[columnName] = {
      type: columnType,
      allowNull,
      ...options,
      defaultValue: target[columnName],
    }
  }
}

/**
 * Decorator for defining validators on a database table column
 * @param {[object]} validations column value validations
 * @param {object} options validation options
 * @returns {Function} decorator
 */
export function validate (validations, options = {}) {
  return (target, name) => {
    const columnName = options.name ?? name
    if (Reflect.has(target.columns, columnName) === false) {
      throw new TypeError('Attempted to validate a field that has not been declared as a column')
    }

    target.columns[columnName].validate = validations
  }
}
