/**
 * Parses an object of URL query parameters and builds a nested object by delimiting periods into sub objects.
 * @param {object} query an object of URL query parameters
 * @returns {object} a nested object
 */
export default function parseQuery (query) {
  return Object.entries(query).reduce((acc, [key, value]) => {
    const [last, ...paths] = key.split('.').reverse()
    const object = paths.reduce((pathAcc, el) => {
      return { [el]: pathAcc }
    }, { [last]: value })
    return { ...acc, ...object }
  }, {})
}
