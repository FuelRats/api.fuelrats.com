/* eslint-disable no-magic-numbers */
let configErrors = 0
let configWarnings = 0

const config = {
  server: {
    hostname: required('FRAPI_HOSTNAME', [], 'localhost'),
    port: required('FRAPI_PORT', [], 8080),
    externalUrl: required('FRAPI_URL', [], 'http://localhost:8080'),
    cookieSecret: required('FRAPI_COOKIE', []),
    proxyEnabled: required('FRAPI_PROXY_ENABLED', [], false),
    ropcClientId: recommended('FRAPI_ROPC_CLIENTID', [])
  },
  postgres: {
    database: required('FRAPI_POSTGRES_DATABASE', [], 'fuelrats'),
    hostname: required('FRAPI_POSTGRES_HOSTNAME', [], 'localhost'),
    port: required('FRAPI_POSTGRES_PORT', [], 5432),
    username: required('FRAPI_POSTGRES_USERNAME', [], 'fuelrats'),
    password: optional('FRAPI_POSTGRES_PASSWORD', [], undefined)
  },
  anope: {
    database: required('FRAPI_ANOPE_DATABASE', [], 'anope'),
    hostname: required('FRAPI_ANOPE_HOSTNAME', [], 'localhost'),
    port: required('FRAPI_ANOPE_PORT', [], 3306),
    username: required('FRAPI_ANOPE_USERNAME', [], 'anope'),
    password: optional('FRAPI_ANOPE_PASSWORD', [], undefined)
  },
  geoip: {
    directory: required('FRAPI_GEOIP_DIRECTORY', [], undefined)
  },
  frontier: {
    clientId: recommended('FRAPI_FRONTIER_CLIENTID', [], undefined),
    sharedKey: recommended('FRAPI_FRONTIER_SHAREDKEY', [], undefined),
    redirectUri: recommended('FRAPI_FRONTIER_REDIRECTURI', [], undefined)
  },
  graylog: {
    database: recommended('FRAPI_GRAYLOG_HOST', [], undefined),
    port: recommended('FRAPI_GRAYLOG_PORT', [], 12201),
    facility: recommended('FRAPI_GRAYLOG_FACILITY', [], 'fuelratsapi')
  },
  slack: {
    token: recommended('FRAPI_SLACK_TOKEN', [], undefined),
    username: recommended('FRAPI_SLACK_USERNAME', [], undefined)
  },
  smtp: {
    hostname: recommended('FRAPI_SMTP_HOSTNAME', [], 'smtp-relay.gmail.com'),
    port: recommended('FRAPI_SMTP_PORT', [], 587),
    sender: recommended('FRAPI_SMTP_SENDER', [], 'blackhole@fuelrats.com')
  },
  jira: {
    username: recommended('FRAPI_JIRA_USERNAME', [], undefined),
    password: recommended('FRAPI_JIRA_PASSWORD', [], undefined)
  }
}

console.log(`${configErrors} config errors.`)
console.log(`${configWarnings} config warnings.`)
if (configErrors > 0) {
  console.log('FATAL CONFIGURATION PROBLEMS DETECTED, EXITING')
  process.abort()
}

/**
 * Require a config environment variable. This setting will cause a fatal error if invalid
 * @param {string} property The environment variable name
 * @param {[Function]} validations array of validation functions to run
 * @param {*} defaultValue default value to be provided for this, if any
 * @returns {*|undefined}
 */
function required (property, validations = [], defaultValue = undefined) {
  const value = process.env[property] || defaultValue
  if (typeof value === 'undefined') {
    console.error(`FATAL ERROR: Required config parameter ${property} is not provided`)
    configErrors += 1
    return undefined
  }

  validations.forEach((validation) => {
    const validationMessage = validation.call(value, value)
    if (validationMessage !== true) {
      console.error(`FATAL ERROR: Required config parameter ${property} did not pass validation. ${validationMessage}`)
      configErrors += 1
    }
  })

  return value
}

/**
 * Set a recommended config environment variable. This setting will generate a warning if invalid
 * @param {string} property The environment variable name
 * @param {[Function]} validations array of validation functions to run
 * @param {*} defaultValue default value to be provided for this, if any
 * @returns {*|undefined}
 */
function recommended (property, validations = [], defaultValue = undefined) {
  const value = process.env[property] || defaultValue
  if (typeof value === 'undefined') {
    console.error(`WARNING: Config parameter ${property} is not configured, 
    functionality will be limited and/or unstable`)
    configWarnings += 1
    return undefined
  }

  validations.forEach((validation) => {
    const validationMessage = validation.call(value, value)
    if (validationMessage !== true) {
      console.warn(`WARNING: Config parameter ${property} did not pass validation. ${validationMessage}`)
      configWarnings += 1
    }
  })

  return value
}

/**
 * Set an optional config environment variable. This setting will generate a warning only if it fails validation
 * @param {string} property The environment variable name
 * @param {[Function]} validations array of validation functions to run
 * @param {*} defaultValue default value to be provided for this, if any
 * @returns {*|undefined}
 */
function optional (property, validations, defaultValue = undefined) {
  const value = process.env[property] || defaultValue

  validations.forEach((validation) => {
    const validationMessage = validation.call(value, value)
    if (validationMessage !== true) {
      console.warn(`WARNING: Config parameter ${property} did not pass validation. ${validationMessage}`)
      configWarnings += 1
    }
  })

  return value
}

export default config
