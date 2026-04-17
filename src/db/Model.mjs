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
 * TC39 class decorator for defining the settings of a database table
 * @param {object} options table options
 * @returns {Function} decorator
 */
export function table (options) {
  return (target, context) => {
    Object.defineProperty(target, 'options', {
      value: options,
      writable: true,
      configurable: true,
      enumerable: true,
    })
  }
}

/**
 * TC39 field decorator for defining a database table column
 * @param {Sequelize.DataTypes} columnType the data type of the column
 * @param {object} [options] column options
 * @param {boolean} [options.allowNull] allow this column to have null values
 * @returns {Function} decorator
 */
export function column (columnType, { allowNull = false, ...options } = {}) {
  return (value, context) => {
    context.addInitializer(function () {
      const columnName = options.name ?? context.name
      this.columns = this.columns ?? {}
      this.columns[columnName] = {
        type: columnType,
        allowNull,
        ...options,
        defaultValue: this[context.name],
      }
    })
  }
}

/**
 * TC39 field decorator for defining validators on a database table column
 * @param {object} validations column value validations
 * @param {object} [options] validation options
 * @returns {Function} decorator
 */
export function validate (validations, options = {}) {
  return (value, context) => {
    context.addInitializer(function () {
      const columnName = options.name ?? context.name
      if (!this.columns || Reflect.has(this.columns, columnName) === false) {
        throw new TypeError('Attempted to validate a field that has not been declared as a column')
      }

      this.columns[columnName].validate = validations
    })
  }
}
