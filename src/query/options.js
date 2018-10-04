

/**
 * Class representing a Sequelize database field query constructed from an API subquery
 */
class QueryOptions {
  /**
   * Convert a field.min parameter to a Sequelize greater-than sub query
   * @param parent the parent object
   * @param key the min key
   * @returns {*} A sequelize sub query
   */
  static min (parent, key) {
    parent.gte = parent[key]
    delete parent[key]
    return parent
  }

  /**
   * Convert a field.max parameter to a Sequelize greater-than sub query
   * @param parent the parent object
   * @param key the max query
   * @returns {*} a sequelize sub query
   */
  static max (parent, key) {
    parent.lte = parent[key]
    delete parent[key]
    return parent
  }
}

module.exports = QueryOptions
