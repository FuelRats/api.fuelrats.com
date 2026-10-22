import { BadRequestAPIError } from '../classes/APIError'
import { operatorsAliases } from '../db/index.mjs'

const maxFilterDepth = 8

// Every operator the query layer exposes (kept in sync with the Sequelize operator aliases,
// so no operator is removed). These are the only non-column keys allowed inside a filter.
const allowedOperators = new Set(Object.keys(operatorsAliases))

// Logical operators compose sub-filters whose own keys are columns or further logical operators.
const logicalOperators = new Set(['and', 'or', 'not'])

/**
 * Whether a value is an acceptable filter leaf (a scalar)
 * @param {*} value the value to check
 * @returns {boolean} true if the value is a string, number, boolean, or null
 */
function isScalar (value) {
  return value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
}

/**
 * Validate the value side of a `column: value` filter clause. A value is either a scalar
 * (shorthand equality), an array of scalars, or an object whose keys are all known operators
 * whose operands recurse by the same rule. This preserves every operator and nesting pattern
 * while rejecting a non-operator key or a non-scalar leaf (the type-confusion vector).
 * @param {*} value the value to validate
 * @param {number} depth current recursion depth
 * @throws {BadRequestAPIError} if the value shape is not permitted
 */
function validateValue (value, depth) {
  if (depth > maxFilterDepth) {
    throw new BadRequestAPIError({ parameter: 'filter' })
  }
  if (isScalar(value)) {
    return
  }
  if (Array.isArray(value)) {
    value.forEach((element) => {
      return validateValue(element, depth + 1)
    })
    return
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([operator, operand]) => {
      if (allowedOperators.has(operator) === false) {
        throw new BadRequestAPIError({ parameter: `filter operator '${operator}'` })
      }
      validateValue(operand, depth + 1)
    })
    return
  }
  throw new BadRequestAPIError({ parameter: 'filter' })
}

/**
 * Validate a filter node: an object whose keys are either logical operators (recursing into
 * their sub-filters) or columns that must appear in the allowed set.
 * @param {*} node the filter node to validate
 * @param {Set<string>} filterable the set of columns the caller may filter on
 * @param {number} depth current recursion depth
 * @throws {BadRequestAPIError} if a disallowed column or shape is present
 */
function validateNode (node, filterable, depth) {
  if (depth > maxFilterDepth) {
    throw new BadRequestAPIError({ parameter: 'filter' })
  }
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new BadRequestAPIError({ parameter: 'filter' })
  }
  Object.entries(node).forEach(([key, value]) => {
    if (logicalOperators.has(key)) {
      const operands = Array.isArray(value) ? value : [value]
      operands.forEach((operand) => {
        return validateNode(operand, filterable, depth + 1)
      })
      return
    }
    if (filterable.has(key) === false) {
      throw new BadRequestAPIError({ parameter: `filter[${key}]` })
    }
    validateValue(value, depth + 1)
  })
}

/**
 * Validate a parsed JSON:API filter against the columns a caller is permitted to read.
 * Preserves the full operator vocabulary and wire syntax; only the column scope is enforced.
 * @param {object} filter the parsed filter object (may be empty)
 * @param {string[]|Set<string>} filterableFields columns the caller may filter on
 * @throws {BadRequestAPIError} if the filter references a disallowed column or an invalid shape
 */
export default function validateFilter (filter, filterableFields) {
  if (!filter || Object.keys(filter).length === 0) {
    return
  }
  const filterable = filterableFields instanceof Set ? filterableFields : new Set(filterableFields)
  validateNode(filter, filterable, 0)
}
