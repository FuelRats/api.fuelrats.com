/**
 * Decorator to turn a class into a quasi Enum
 * @param {object?} target
 * @param {boolean?} target.symbols Use symbols to represent enum members with no defined value (Default: `true`)
 * @returns {Function} enumerable class decorator
 */
export default function enumerable ({ symbols = true } = {}) {
  return (target) => {
    const properties = Reflect.ownKeys(target)
    const keys = []

    properties.forEach((key) => {
      if (Reflect.has(target, key) && typeof target[key] === 'undefined') {
        if (symbols) {
          target[key] = Symbol(key.toString())
        } else {
          target[key] = key.toString()
        }
        keys.push(key)
      }
    })

    Reflect.defineProperty(target, 'keys', {
      get: () => {
        return keys
      },
      static: true,
    })

    Object.freeze(target)
  }
}
