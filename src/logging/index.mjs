import crypto from 'node:crypto'
import log4js from 'log4js'
import config from '../config'

const logConfig = {
  appenders: {
    console: {
      type: 'console',
      layout: { type: 'pattern', pattern: '%d{ISO8601} [%p] %c - %m' },
    },
    stderr: {
      type: 'stderr',
      layout: { type: 'pattern', pattern: '%d{ISO8601} [%p] %c - %m' },
    },
    consoleFilter: {
      type: 'logLevelFilter',
      appender: 'console',
      level: 'debug',
      maxLevel: 'warn',
    },
    errorFilter: {
      type: 'logLevelFilter',
      appender: 'stderr',
      level: 'error',
    },
    email: {
      type: '@log4js-node/smtp',
      subject: 'Fuel Rats API Problem',
      sender: 'blackhole@fuelrats.com',
      recipients: 'techrats@fuelrats.com',
      SMTP: config.smtp,
      sendInterval: 3600,
    },
  },
  categories: {
    default: {
      appenders: ['consoleFilter', 'errorFilter'],
      level: 'info',
    },
    fatal: {
      appenders: ['errorFilter', 'email'],
      level: 'error',
    },
    metrics: {
      appenders: ['consoleFilter'],
      level: 'info',
    },
  },
}

// Add Graylog if configured
if (config.graylog.host) {
  logConfig.appenders.graylog = {
    type: '@log4js-node/gelf',
    host: config.graylog.host,
    port: config.graylog.port,
    facility: config.graylog.facility,
  }

  // In production, send logs to Graylog instead of/in addition to console
  if (process.env.NODE_ENV === 'production') {
    logConfig.categories.default.appenders = ['graylog', 'errorFilter']
    logConfig.categories.fatal.appenders = ['graylog', 'errorFilter', 'email']
    logConfig.categories.metrics.appenders = ['graylog']
  } else {
    // In development, send to both console and Graylog
    logConfig.categories.default.appenders.push('graylog')
    logConfig.categories.fatal.appenders.push('graylog')
    logConfig.categories.metrics.appenders.push('graylog')
  }
}

log4js.configure(logConfig)


const logger = log4js.getLogger()
const errorLogger = log4js.getLogger('fatal')
const metricsLogger = log4js.getLogger('metrics')

/**
 * Log application metrics
 * @param {string} event - The event type
 * @param {object} data - Metric data
 * @param {string} message - Optional message
 */
export function logMetric (event, data, message = '') {
  metricsLogger.info({
    GELF: true,
    _event: 'metric',
    _metric_type: event,
    ...data,
  }, message || `Metric: ${event}`)
}

/**
 * Log errors safely without exposing sensitive information
 * @param {Error} error - The error to log
 * @param {object} context - Additional context
 * @param {string} message - Custom error message
 * @returns {string} - Unique error ID for tracking
 */
export function logError (error, context = {}, message = 'An error occurred') {
  const errorId = crypto.randomUUID()

  errorLogger.error({
    GELF: true,
    _event: 'error',
    _error_id: errorId,
    _error_type: error.constructor.name,
    _error_message: error.message,
    _error_stack: error.stack,
    ...context,
  }, `${message} [ID: ${errorId}]`)

  return errorId
}

export default logger
export { errorLogger, metricsLogger }
