 
import {
  required,
  optional,
  recommended,
  ensureValidConfig,
  isBaseUrl,
  isIrcChannel,
  isUUID,
  toArray,
  toStrictBoolean,
  toNumber,
} from './helpers/ConfigValidators'

const config = {
  server: {
    hostname: required('FRAPI_HOSTNAME', [], 'localhost'),
    port: required('FRAPI_PORT', [toNumber], 8080),
    externalUrl: required('FRAPI_URL', [isBaseUrl], 'http://localhost:8080'),
    cookieSecret: required('FRAPI_COOKIE', [], undefined),
    proxyEnabled: required('FRAPI_PROXY_ENABLED', [toStrictBoolean], false),
    whitelist: optional('FRAPI_WHITELIST', [toArray], []),
  },
  frontend: {
    clientId: recommended('FRAPI_FRONTEND_CLIENTID', [isUUID], undefined),
    url: required('FRAPI_FRONTEND_URL', [isBaseUrl], 'https://fuelrats.com'),
  },
  postgres: {
    database: required('FRAPI_POSTGRES_DATABASE', [], 'fuelrats'),
    hostname: required('FRAPI_POSTGRES_HOSTNAME', [], 'localhost'),
    port: required('FRAPI_POSTGRES_PORT', [toNumber], 5432),
    username: required('FRAPI_POSTGRES_USERNAME', [], 'fuelrats'),
    password: optional('FRAPI_POSTGRES_PASSWORD', [], undefined),
  },
  anope: {
    database: optional('FRAPI_ANOPE_DATABASE', [], undefined),
    hostname: required('FRAPI_ANOPE_HOSTNAME', [], 'localhost'),
    port: required('FRAPI_ANOPE_PORT', [toNumber], 3306),
    username: required('FRAPI_ANOPE_USERNAME', [], 'anope'),
    password: optional('FRAPI_ANOPE_PASSWORD', [], undefined),
    // Anope SQL table prefix. Anope 2.0 wrote `anope_db_`; 2.1 defaults to `anope21_`.
    tablePrefix: required('FRAPI_ANOPE_TABLE_PREFIX', [], 'anope_db_'),
    // Anope 2.1 JSON-RPC endpoint (e.g. https://services.fuelrats.com:6080/jsonrpc)
    // and its bearer token. Replaces the removed XML-RPC interface.
    jsonrpc: optional('FRAPI_ANOPE_JSONRPC', [], undefined),
    jsonrpcToken: optional('FRAPI_ANOPE_JSONRPC_TOKEN', [], undefined),
  },
  irc: {
    server: recommended('FRAPI_IRC_SERVER', [], undefined),
    serverName: recommended('FRAPI_IRC_SERVERNAME', [], undefined),
    port: recommended('FRAPI_IRC_PORT', [toNumber], 6900),
    password: recommended('FRAPI_IRC_PASSWORD', [], undefined),
  },
  geoip: {
    directory: required('FRAPI_GEOIP_DIRECTORY', [], undefined),
  },
  announcer: {
    url: recommended('FRAPI_ANNOUNCER,URL', [], 'https://announcer-dev.fuelrats.com/api'),
    secret: recommended('FRAPI_ANNOUNCER_SECRET', [], undefined),
    destinations: {
      rescue: recommended('FRAPI_ANNOUNCER_DESTINATION_RESCUE', [isIrcChannel], '#ratchat'),
      moderation: recommended('FRAPI_ANNOUNCER_DESTINATION_MODERATION', [isIrcChannel], '#rat-ops'),
      network: recommended('FRAPI_ANNOUNCER_DESTINATION_NETWORK', [isIrcChannel], '#opers'),
      technical: recommended('FRAPI_ANNOUNCER_DESTINATION_TECHNICAL', [isIrcChannel], '#rattech'),
      drill: recommended('FRAPI_ANNOUNCER_DESTINATION_DRILL', [isIrcChannel], '#doersofstuff'),
    },
  },
  frontier: {
    clientId: recommended('FRAPI_FRONTIER_CLIENTID', [], undefined),
    sharedKey: recommended('FRAPI_FRONTIER_SHAREDKEY', [], undefined),
    redirectUri: recommended('FRAPI_FRONTIER_REDIRECTURI', [], undefined),
  },
  smtp: {
    hostname: optional('FRAPI_SMTP_HOSTNAME', [], 'smtp-relay.gmail.com'),
    username: optional('FRAPI_SMTP_USERNAME', [], undefined),
    password: optional('FRAPI_SMTP_PASSWORD', [], undefined),
    port: recommended('FRAPI_SMTP_PORT', [toNumber], 587),
    sender: recommended('FRAPI_SMTP_SENDER', [], 'blackhole@fuelrats.com'),
  },
  jira: {
    url: recommended('FRAPI_JIRA_URL', [isBaseUrl], undefined),
    username: recommended('FRAPI_JIRA_USERNAME', [], undefined),
    password: recommended('FRAPI_JIRA_PASSWORD', [], undefined),
  },
  graylog: {
    host: recommended('FRAPI_GRAYLOG_HOST', [], undefined),
    port: recommended('FRAPI_GRAYLOG_PORT', [toNumber], 12201),
    facility: recommended('FRAPI_GRAYLOG_FACILITY', [], 'fuelratsapi'),
  },
  jwt: {
    secret: required('FRAPI_JWT_SECRET'),
  },
  webpush: {
    privateKey: recommended('FRAPI_WEBPUSH_PRIVATE_KEY', [], undefined),
    publicKey: recommended('FRAPI_WEBPUSH_PUBLIC_KEY', [], undefined),
  },
}

ensureValidConfig()





export default config
