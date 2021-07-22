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
    this.value = process.env[property] ?? defaultValue
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
   * Displays an unrecoverable error with the given message.
   *
   * @param {...string} messages A list of messages to display. Each string representing a line in the message.
   */
  error (...messages) {
    console.error('FATAL ERROR', ...this._getMessage(messages))
    configErrors += 1
  }

  /**
   * Displays a warning with the given message.
   *
   * @param {...string} messages A list of messages to display. Each string representing a line in the message.
   */
  warn (...messages) {
    console.warn('WARNING:', ...this._getMessage(messages))
    configWarnings += 1
  }

  /**
   * Displays a warning which follows a standard message structure.
   *
   * @param {string} validType A string representing the expected valid type of value.
   * @param {string?} nextValue The value that will be used instead of the provided value.
   * @param {string?} expectedExplainer A sentance that explains what value was expected.
   */
  warnStructured (validType, nextValue, expectedExplainer) {
    this.warn([
      `Config parameter '${this.property}' was not provided a valid ${validType}.`,
      expectedExplainer && `Expected: ${expectedExplainer}`,
      nextValue && `Parameter will become: '${nextValue}'.`,
    ])
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
  const isRecommend = (ctx) => {
    if (typeof ctx.value === 'undefined') {
      ctx.warn(
        `Recommended config parameter '${ctx.property}' is not configured.`,
        'Functionality will be limited and/or unstable.',
      )
    }
  }

  return optional(property, [...validations, isRecommend], defaultValue)
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
  const isRequired = (ctx) => {
    if (typeof ctx.value === 'undefined') {
      ctx.error(
        `Required config parameter '${ctx.property}' is not configured.`,
        'Parameter must be configured to continue!',
      )
    }
  }

  return optional(property, [...validations, isRequired], defaultValue)
}


/**
 * Config validator that ensures the value is a valid IRC channel name as defined by RFC1459.
 *
 * @param {ValidatorContext} ctx Config Validator context instance
 */
export function isIrcChannel (ctx) {
  const { value, defaultValue } = ctx
  if (typeof value === 'string' && !IRCChannel.test(value)) {
    ctx.value = defaultValue
    ctx.warnStructured(
      'IRC Channel name',
      defaultValue,
      "A string that begins with '#' or '&', and contains no whitespaces or commas.",
    )
  }
}

/**
 * Config validator that ensures the value is a valid UUID string.
 *
 * @param {ValidatorContext} ctx Config Validator context instance
 */
export function isUUID (ctx) {
  const { value, defaultValue } = ctx
  if (typeof value === 'string' && !UUID.test(value)) {
    ctx.value = defaultValue
    ctx.warnStructured(
      'UUID',
      defaultValue,
      "A string in the format of 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'.",
    )
  }
}


/**
 * Config validator that splits a string by the array delimiter ','. Does not validate further.
 *
 * @param {ValidatorContext} ctx Config Validator context instance
 */
export function isArray (ctx) {
  const { value } = ctx
  if (typeof value === 'string') {
    ctx.value = value.split(',')
  }
}

/**
 * Config validator which converts a string to a number value.
 *
 * @param {ValidatorContext} ctx Config Validator context instance
 */
export function isNumber (ctx) {
  const { value, defaultValue } = ctx
  if (typeof value === 'string') {
    // Use Number() cast instead of parseInt() because Number() is more strict on string values.
    const intValue = Number(value)

    if (Number.isNaN(intValue)) {
      ctx.value = defaultValue
      ctx.warnStructured('number', defaultValue)
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
export function isBoolean (ctx) {
  const { value } = ctx
  if (typeof value === 'string') {
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
export function isStrictBoolean (ctx) {
  const { value, defaultValue } = ctx
  if (typeof value === 'string') {
    if (['true', 'false'].includes(value.toLowerCase())) {
      isBoolean(ctx)
    } else {
      // if string value is not explicitly 'true' or 'false', throw warning, then revert to default value
      ctx.value = defaultValue
      ctx.warnStructured(
        'boolean-like string',
        defaultValue,
        "A case insensitive string matching 'true' or 'false'.",
      )
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
    console.error('FATAL CONFIGURATION PROBLEMS DETECTED, EXITING')
    process.abort()
  }
}
