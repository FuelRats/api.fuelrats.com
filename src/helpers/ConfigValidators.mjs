import { readDockerSecret } from './DockerSecrets'
import { IRCChannel, UUID } from './Validators'




let configErrors = 0
let configWarnings = 0


/**
 * Provides a context object for validator functions assigned to a config value.
 * Also responsible for running the provided validation functions.
 */
class ValidatorContext {
  property = ''
  value = undefined
  defaultValue = undefined

  /**
   * @param {string} property The environment variable name
   * @param {Function[]} validations array of validation functions to run
   * @param {*} defaultValue default value to be provided for this, if any
   */
  constructor (property, validations = [], defaultValue) {
    // First try environment variable, then Docker secret, then default
    this.value = process.env[property]
    if (!this.value) {
      const secretName = property.toLowerCase()
      this.value = readDockerSecret(secretName)
    }
    if (!this.value) {
      this.value = defaultValue
    }

    this.property = property
    this.defaultValue = defaultValue

    if (typeof defaultValue !== 'undefined' && this.value === defaultValue) {
      // Don't waste time validating defined default values
      return
    }

    validations.forEach((validator) => {
      validator.call(this, this)
    })
  }

  /**
   * Formats an array of message lines.
   *
   * @param {string[]} messages A list of messages to display. Each string representing a line in the message.
   * @returns {string[]}
   */
  _getMessage (messages) {
    return messages.reduce((acc, line) => {
      if (line) {
        acc.push(`\n    ${line}`)
      }
      return acc
    }, [])
  }

  /**
   * logs an unrecoverable error with the given message.
   *
   * @param {...string} messages A list of messages to display. Each argument representing a line in the message.
   */
  error (...messages) {
    console.error('FATAL ERROR', ...this._getMessage(messages))
    configErrors += 1
  }

  /**
   * logs a warning with the given message.
   *
   * @param {...string} messages A list of messages to display. Each argument representing a line in the message.
   */
  warn (...messages) {
    console.warn('WARNING', ...this._getMessage(messages))
    configWarnings += 1
  }

  /**
   * logs a warning which follows a standard message structure, then reverts the value to default
   *
   * @param {object} arg function arguments object
   * @param {string} arg.type A string representing the expected value type.
   * @param {string?} arg.expected A sentance that explains what was expected of the value.
   */
  warnSetDefault ({ type, expected }) {
    this.warn(
      `Config property '${this.property}' was not provided a valid ${type}.`,
      expected && `Expected: ${expected}`,
      `Parameter will become: '${this.defaultValue}'.`,
    )
    this.value = this.defaultValue
  }

  /**
   * logs a warning which follows a standard message structure, then sets the next value.
   *
   * @param {object} arg function arguments object
   * @param {string} arg.value The value that will be used instead of the provided value.
   * @param {string} arg.type A string representing the expected value type.
   * @param {string} arg.problem A mid-sentence string explaining the cause of the warning.
   * @param {string?} arg.expected A sentance that explains what was expected of the value.
   */
  warnSetValue ({ value, type, problem, expected }) {
    this.warn(
      `Config property '${this.property}' was provided a valid ${type}, however ${problem}`,
      expected && `Expected: ${expected}`,
      `Parameter will be corrected to: '${value}'.`,
    )
    this.value = value
  }

  /**
   * Convenience function for validators to determine if they should continue with validation.
   *
   * @param {string?} type Expected value type. (Default: `'string'`)
   * @returns {boolean}
   */
  hasValue (type = 'string') {
    return typeof this.value === type
  }
}





/**
 * Get and validate an environment variable
 *
 * @param {string} property The environment variable name
 * @param {Function[]} validations array of validation functions to run
 * @param {*} defaultValue default value to be provided for this, if any
 * @returns {*|undefined}
 */
export function optional (property, validations = [], defaultValue = undefined) {
  return (new ValidatorContext(property, validations, defaultValue)).value
}

/**
 * Set a recommended config environment variable. This setting will cause a warning if value is `undefined`.
 *
 * @param {string} property The environment variable name
 * @param {Function[]} validations array of validation functions to run
 * @param {*} defaultValue default value to be provided for this, if any
 * @returns {*|undefined}
 */
export function recommended (property, validations = [], defaultValue = undefined) {
  return optional(property, [...validations, isRecommended], defaultValue)
}

/**
 * Require and validate a config environment variable. This setting will cause a fatal error if value is `undefined`.
 *
 * @param {string} property The environment variable name
 * @param {Function[]} validations array of validation functions to run
 * @param {*} defaultValue default value to be provided for this, if any
 * @returns {*|undefined}
 */
export function required (property, validations = [], defaultValue = undefined) {
  return optional(property, [...validations, isRequired], defaultValue)
}





/**
 * Config validator that warns when a value is `undefined`.
 *
 * @see {@link recommended} Use the recommened function to define your property instead.
 * @param {ValidatorContext} ctx Config Validator context instance
 */
export function isRecommended (ctx) {
  if (typeof ctx.value === 'undefined') {
    ctx.warn(
      `Recommended config property '${ctx.property}' is not configured.`,
      'Functionality will be limited and/or unstable.',
    )
  }
}

/**
 * Config validator that errors when a value is `undefined`.
 *
 * @see {@link required} Use the required function to define your property instead.
 * @param {ValidatorContext} ctx Config Validator context instance
 */
export function isRequired (ctx) {
  if (typeof ctx.value === 'undefined') {
    ctx.error(
      `Required config property '${ctx.property}' is not configured.`,
      'Parameter must be configured to continue!',
    )
  }
}

/**
 * Config validator that ensures the value is a valid RFC1459 IRC channel name.
 *
 * @param {ValidatorContext} ctx Config Validator context instance
 */
export function isIrcChannel (ctx) {
  const { value } = ctx
  if (ctx.hasValue() && !IRCChannel.test(value)) {
    ctx.warnSetDefault({
      type: 'IRC Channel name',
      expected: "A string that begins with '#' or '&', and contains no whitespaces or commas.",
    })
  }
}

/**
 * Config validator that ensures the value is a valid UUID string.
 *
 * @param {ValidatorContext} ctx Config Validator context instance
 */
export function isUUID (ctx) {
  const { value } = ctx
  if (ctx.hasValue() && !UUID.test(value)) {
    ctx.warnSetDefault({
      type: 'UUID',
      expected: "A string in the format of 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'.",
    })
  }
}

/**
 * Config Validator that ensures a number of factors for URL values
 *
 * 1. It is a valid URL (verified by URL API)
 * 2. The URL is secure (and will error in production)
 * 3. The URL does not end with a trailing slash, as the API will append them.
 *
 * @param {ValidatorContext} ctx Config Validator context instance
 */
export function isBaseUrl (ctx) {
  const type = 'URL'
  const { property, value } = ctx
  if (ctx.hasValue()) {
    try {
      const baseUrl = new URL(value)

      if (baseUrl.protocol === 'http:') {
        const errorMsg = `Config property '${property}' is a non-secure URL!`

        if (process.env.NODE_ENV === 'production') {
          ctx.error(errorMsg, 'A base URL MUST be secure in production mode!')
        } else {
          ctx.warn(errorMsg, 'This will produce an error in production mode.')
        }
      }

      if (value.endsWith('/')) {
        ctx.warnSetValue({
          type,
          value: value.replace(/\/+$/u, ''),
          problem: 'it contains a trailing slash.',
        })
      }
    } catch {
      ctx.warnSetDefault({ type, expected: 'A string which represents a valid URL.' })
    }
  }
}





/**
 * Config validator that splits a string by the array delimiter ','. Does not validate further.
 *
 * @param {ValidatorContext} ctx Config Validator context instance
 */
export function toArray (ctx) {
  const { value } = ctx
  if (ctx.hasValue()) {
    ctx.value = value.split(',')
  }
}

/**
 * Config validator which converts a string to a number value.
 *
 * @param {ValidatorContext} ctx Config Validator context instance
 */
export function toNumber (ctx) {
  const { value } = ctx
  if (ctx.hasValue()) {
    // Use Number() cast instead of parseInt() because Number() is more strict on string values.
    const intValue = Number(value)

    if (Number.isNaN(intValue)) {
      ctx.warnSetDefault({ type: 'number' })
    } else {
      ctx.value = intValue
    }
  }
}

/**
 * Config validator which converts a string to a boolean value.
 *
 * * sets `true` if `value` is `'true'` (case-insensitive).
 * * Otherwise, sets `false`
 *
 * @param {ValidatorContext} ctx Config Validator context instance
 */
export function toBoolean (ctx) {
  const { value } = ctx
  if (ctx.hasValue()) {
    ctx.value = value.toLowerCase() === 'true'
  }
}

/**
 * Config validator which converts a string to a boolean value.
 *
 * * sets `true` if `value` is `'true'` (case-insensitive).
 * * sets `false` if `value` is `'false'` (case-insensitive).
 * * Otherwise, a warning is thrown and the value is set to it's default value.
 *
 * @param {ValidatorContext} ctx Config Validator context instance
 */
export function toStrictBoolean (ctx) {
  const { value } = ctx
  if (ctx.hasValue()) {
    if (['true', 'false'].includes(value.toLowerCase())) {
      toBoolean(ctx)
    } else {
      // if string value is not explicitly 'true' or 'false', throw warning, then revert to default value
      ctx.warnSetDefault({
        type: 'boolean',
        expected: "Value of 'true' or 'false'.",
      })
    }
  }
}

/**
 * Emits meta-information about config errors and warnings, then aborts the process if errors are present.
 */
export function ensureValidConfig () {
  console.error(`${configErrors} config errors.`)
  console.warn(`${configWarnings} config warnings.`)
  if (configErrors > 0) {
    console.error('FATAL CONFIGURATION PROBLEMS DETECTED, EXITING...')
    process.abort()
  }
}
