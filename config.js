/* eslint-disable no-magic-numbers */

// noinspection SpellCheckingInspection
module.exports = {
  'cookie': {
    'domain': process.env.FRAPI_COOKIE_DOMAIN || 'localhost',
    'secret': process.env.FRAPI_COOKIE_SECRET || 'oUAAAAAMkdpS2l6E'
  },
  'xmlrpc': {

    'url': process.env.FRAPI_XMLRPC_URL || 'https://irc.eu.fuelrats.com:6080/xmlrpc',
    'insecure': process.env.FRAPI_XMLRPC_INSECURE || false
  },

  'hostname': process.env.FRAPI_HOSTNAME || 'localhost',
  'externalUrl': process.env.FRAPI_URL || 'https://api.fuelrats.com',
  'port': process.env.FRAPI_PORT || 8082,
  'proxyEnabled': process.env.FRAPI_PROXY_ENABLED || false,
  'postgres': {
    'database': process.env.FRAPI_POSTGRES_DATABASE || 'fuelrats',
    'hostname': process.env.FRAPI_POSTGRES_HOSTNAME || 'localhost',
    'username': process.env.FRAPI_POSTGRES_USERNAME || 'fuelrats',
    'password': process.env.FRAPI_POSTGRES_PASSWORD || 'SqueakBaby',
    'port': process.env.FRAPI_POSTGRES_PORT || 5432
  },
  'anope': {
    'database': process.env.FRAPI_ANOPE_DATABASE || 'anope',
    'hostname': process.env.FRAPI_ANOPE_HOSTNAME || 'localhost',
    'username': process.env.FRAPI_ANOPE_USERNAME || 'anope2',
    'password': process.env.FRAPI_ANOPE_PASSWORD || '',
    'port': process.env.FRAPI_ANOPE_PORT || 3306
  },
  'smtp': {
    'host': process.env.SMTP_HOSTNAME || 'smtp-relay.gmail.com',
    'email': process.env.SMTP_EMAIL || 'blackhole@fuelrats.com'
  },
  'recaptcha': {
    'secret': process.env.FRAPI_RECAPTCHA_SECRET || ''
  },
  'jira': {
    'username': process.env.FRAPI_JIRA_USERNAME || '',
    'password': process.env.FRAPI_JIRA_PASSWORD || ''
  },
  'test': {
    'postgres': {
      'database': process.env.FRAPI_TEST_POSTGRES_DATABASE || 'fuelratstest',
      'hostname': process.env.FRAPI_TEST_POSTGRES_HOSTNAME || 'localhost',
      'username': process.env.FRAPI_TEST_POSTGRES_USERNAME || 'fuelrats',
      'password': process.env.FRAPI_TEST_POSTGRES_PASSWORD || 'SqueakBaby',
      'port': process.env.FRAPI_TEST_POSTGRES_PORT || 5432
    }
  },
  'loggly': {
    'appenders': {
      'console': {
        'type': process.env.FRAPI_LOGGLY_TEST_APPENDERS_CONSOLE_TYPE || 'console'
      }
    },
    'categories': {
      'default': {
        'appenders': process.env.FRAPI_LOGGLY_TEST_CATEGORIES_DEFAULT_APPENDERS ?
          JSON.parse(process.env.FRAPI_LOGGLY_TEST_CATEGORIES_DEFAULT_APPENDERS) : [ 'console' ],
        'level': process.env.FRAPI_LOGGLY_TEST_CATEGORIES_DEFAULT_LEVEL || 'info'
      }
    }
  },
  'testing': {
    'token': process.env.FRAPI_TESTING_TOKEN || 'testingadmintoken'
  }
}
