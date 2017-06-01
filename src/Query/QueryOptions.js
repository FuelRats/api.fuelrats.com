/**
 * Class representing a Sequelize database field query constructed from an API subquery
 */
class QueryOptions {
  /**
   * Convert a field.min parameter to a Sequelize greater-than sub query
   * @param value The sequelize sub query
   */
  static min (parent, key) {
    parent.gte = parent[key]
    delete parent[key]
    return parent
  }

  static max (parent, key) {
    parent.lte = parent[key]
    delete parent[key]
    return parent
  }
}

export default QueryOptions