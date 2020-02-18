/**
 * Implementation of an equivalent to python's zip() function in JavaScript
 * @generator
 * @param {[Array]} collections
 * @yields {Array} generated collection
 */
export default function * zip (...collections) {
  const iterators = collections.map((iterator) => {
    return iterator[Symbol.iterator]()
  })
  while (true) {
    const results = iterators.map((iterator) => {
      return iterator.next()
    })

    const hasResult = results.some((result) => {
      return result.done
    })

    if (hasResult) {
      return undefined
    }
    yield results.map((result) => {
      return result.value
    })
  }
}
