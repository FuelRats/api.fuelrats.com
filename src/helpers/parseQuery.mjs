/**
 * Deep merge source into target object
 * @param {object} target target object
 * @param {object} source source object
 * @returns {object} merged object
 */
function deepMerge (target, source) {
  const result = { ...target }
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)
      && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key], value)
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * Parses an object of URL query parameters and builds a nested object by
 * delimiting periods and brackets into sub objects.
 * Handles both dot notation (filter.name=foo) and bracket notation (page[size]=25).
 * @param {object} query an object of URL query parameters
 * @returns {object} a nested object
 */
export default function parseQuery (query) {
  return Object.entries(query).reduce((acc, [key, value]) => {
    // Normalise bracket notation to dot notation: page[size] → page.size
    const normalised = key.replace(/\[([^\]]*)\]/gu, '.$1')
    const [last, ...paths] = normalised.split('.').reverse()
    const object = paths.reduce((pathAcc, el) => {
      return { [el]: pathAcc }
    }, { [last]: value })
    return deepMerge(acc, object)
  }, {})
}
