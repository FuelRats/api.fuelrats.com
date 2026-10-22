/**
 * Check if an object has only sequential integer keys (0, 1, 2...) and should be an array
 * @param {object} obj object to check
 * @returns {boolean} true if the object represents an array
 */
function isArrayLike (obj) {
  const keys = Object.keys(obj)
  if (keys.length === 0) {
    return false
  }
  return keys.every((key, index) => String(index) === key)
}

/**
 * Recursively convert objects with sequential integer keys to arrays
 * @param {*} value value to convert
 * @returns {*} converted value
 */
function convertArrayLikes (value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value
  }

  // Recurse first
  const converted = {}
  for (const [key, val] of Object.entries(value)) {
    converted[key] = convertArrayLikes(val)
  }

  if (isArrayLike(converted)) {
    return Object.values(converted)
  }
  return converted
}

// Keys that can corrupt the prototype chain if used as path segments. Assigning `obj.__proto__`
// invokes the prototype setter, so such a segment would silently vanish from own-key iteration
// (sidestepping validation) and is a prototype-pollution footgun. They are never valid query keys.
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor'])

/**
 * Deep merge source into target object
 * @param {object} target target object
 * @param {object} source source object
 * @returns {object} merged object
 */
function deepMerge (target, source) {
  const result = { ...target }
  for (const [key, value] of Object.entries(source)) {
    if (forbiddenKeys.has(key) === false) {
      if (value && typeof value !== 'string' && typeof value === 'object' && !Array.isArray(value)
        && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
        result[key] = deepMerge(result[key], value)
      } else {
        result[key] = value
      }
    }
  }
  return result
}

/**
 * Parses an object of URL query parameters and builds a nested object by
 * delimiting periods and brackets into sub objects.
 * Handles both dot notation (filter.name=foo) and bracket notation (page[size]=25).
 * Objects with sequential integer keys (filter[and][0], filter[and][1]) are converted to arrays.
 * @param {object} query an object of URL query parameters
 * @returns {object} a nested object
 */
export default function parseQuery (query) {
  const result = Object.entries(query).reduce((acc, [key, value]) => {
    // Normalise bracket notation to dot notation: page[size] → page.size
    const normalised = key.replace(/\[([^\]]*)\]/gu, '.$1')
    const segments = normalised.split('.')
    // Drop any parameter whose path uses a prototype-corrupting segment
    if (segments.some((segment) => forbiddenKeys.has(segment))) {
      return acc
    }
    const [last, ...paths] = segments.reverse()
    const object = paths.reduce((pathAcc, el) => {
      return { [el]: pathAcc }
    }, { [last]: value })
    return deepMerge(acc, object)
  }, {})

  return convertArrayLikes(result)
}
