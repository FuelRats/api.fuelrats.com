/**
 * Decorator to turn a class into a quasi Enum
 * @param {object?} target
 * @param {boolean?} target.symbols Use symbols to represent enum members with no defined value (Default: `true`)
 * @returns {Function} enumerable class decorator
 */
export default function enumerable ({ symbols = true } = {}) {
  return (target, context) => {
    const keys = []

    // Static fields are defined after class decorators run, so assign members in a class initializer
    context.addInitializer(() => {
      Reflect.ownKeys(target).forEach((key) => {
        if (Reflect.has(target, key) && typeof target[key] === 'undefined') {
          if (symbols) {
            target[key] = Symbol(key.toString())
          } else {
            target[key] = key.toString()
          }
          keys.push(key)
        }
      })
    })

    Reflect.defineProperty(target, 'keys', {
      get: () => {
        return keys
      },
      static: true,
    })

    // Defer freeze to after Bun finishes setting up decorator metadata
    queueMicrotask(() => {
      Object.freeze(target)
    })
  }
}
