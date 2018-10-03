/* eslint-disable no-magic-numbers */
'use strict'


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
  'recaptcha': {
    'secret': process.env.FRAPI_RECAPTCHA_SECRET || '6LdUsBoUAAAAAMkdpS2l6EE29GOZD9MgT1fhB_u6'
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
      },
      'loggly': {
        'type': process.env.FRAPI_LOGGLY_TEST_APPENDERS_LOGGLY_TYPE || 'frloggly',
        'token': process.env.FRAPI_LOGGLY_TEST_APPENDERS_LOGGLY_TOKEN || 'ce4d2f29-0a0d-4dd5-ad17-e19bc51311a7',
        'subdomain': process.env.FRAPI_LOGGLY_TEST_APPENDERS_LOGGLY_SUBDOMAIN || 'fuelrats',
        'tags': process.env.FRAPI_LOGGLY_TEST_APPENDERS_LOGGLY_TAGS || ['local-dev', 'nodejs'],
        'json': process.env.FRAPI_LOGGLY_TEST_APPENDERS_LOGGLY_JSON || true,
        'layout': {
          'type': process.env.FRAPI_LOGGLY_TEST_APPENDERS_LOGGLY_LAYOUT_TYPE || 'frloggly'
        }
      }
    },
    'categories': {
      'default': {
        'appenders': process.env.FRAPI_LOGGLY_TEST_CATEGORIES_DEFAULT_APPENDERS ? JSON.parse(process.env.FRAPI_LOGGLY_TEST_CATEGORIES_DEFAULT_APPENDERS) : [ 'console', 'loggly' ],
        'level': process.env.FRAPI_LOGGLY_TEST_CATEGORIES_DEFAULT_LEVEL || 'info'
      }
    }
  },
  'stripe': {
    'token': process.env.FRAPI_STRIPE_TOKEN || null,
    'signature': process.env.FRAPI_STRIPE_SIGNATURE || null
  },
  'dropbox': {
    'token': process.env.FRAPI_DROPBOX_TOKEN || null
  }
}
