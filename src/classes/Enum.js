/**
 * Decorator to turn a class into a quasi Enum
 * @param {object} target
 */
export default function enumerable (target) {
  const properties = Reflect.ownKeys(target)
  const keys = []

  properties.forEach((key) => {
    if (Reflect.has(target, key) && typeof target[key] === 'undefined') {
      target[key] = Symbol(key.toString())
      keys.push(key)
    }
  })

  Reflect.defineProperty(target, 'keys', {
    get: () => {
      return keys
    },
    static: true
  })

  Object.freeze(target)
}
