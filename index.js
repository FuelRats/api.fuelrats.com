'use strict'

const SERVER_ERROR_CODE = 500
const WEBSOCKET_IDENTIFIER_ROUNDS = 16

// IMPORT
// =============================================================================
const a = require('koa')
const b = require('koa-session')
const c = require('koa-router')()
const d = new a()
require('koa-qs')(d)
const e = require('koa-body')
const f = require('./api/TrafficControl')
const g = require('koa-ejs')
const h = require('path')
const i = require('http')
const j = require('ws')
const { URL } = require('url')
const k = require('./api/logger')
const { promisify } = require('util')

const l = require('./api/permission')
const m = require('uid-safe')
const n = require('npid')

// Import config
const o = require('./config')

const p = require('./api/errors')


// Import controllers
const q = require('./api/controllers/auth')
const r = require('./api/controllers/client')
const s = require('./api/controllers/decal')
const t = require('./api/controllers/login')
const u = require('./api/controllers/nicknames')
const v = require('./api/controllers/oauth2')
const w = require('./api/controllers/profile')
const x = require('./api/controllers/rat')
const y = require('./api/controllers/register')
const z = require('./api/controllers/reset')
const aa = require('./api/controllers/rescue')
const ab = require('./api/controllers/ship')
const ac = require('./api/controllers/statistics')
const ad = require('./api/controllers/user')
const ae = require('./api/controllers/version')
const af = require('./api/websocket')
const ag = require('./api/controllers/jira/drill')
const { AnopeWebhook } = require('./api/controllers/anope-webhook')
const { db } = require('./api/db')

try {
  n.remove('api.pid')
  let pid = n.create('api.pid')
  pid.removeOnExit()
} catch (err) {
  process.exit(1)
}

d.keys = [o.cookie.secret]

let sessionConfiguration = {
  key: 'fuelrats:session',
  overwrite: true,
  signed: true
}

d.use(b(sessionConfiguration, d))
d.use(require('koa-static')('static', {
  hidden: false,
  gzip: true
}))
d.use(e())

let port = o.port || process.env.PORT

d.use(async function (ctx, next) {
  ctx.data = ctx.request.body
  ctx.meta = af.meta
  ctx.client = {}

  let { query } = ctx
  ctx.query = parseQuery(query)

  ctx.inet = ctx.request.req.headers['x-forwarded-for'] || ctx.request.ip
  await next()
})

d.use(async function (ctx, next) {
  if (Array.isArray(ctx.data) || typeof ctx.data === 'object') {
    ['id', 'createdAt', 'updatedAt', 'deletedAt'].map((cleanField) => {
      delete ctx.data[cleanField]
    })
  }
  await next()
})

const traffic = new f()

d.use(async (ctx, next) => {
  try {
    await q.authenticate(ctx)

    let rateLimit = traffic.validateRateLimit(ctx)

    ctx.set('X-API-Version', '2.0')
    ctx.set('X-Rate-Limit-Limit', rateLimit.total)
    ctx.set('X-Rate-Limit-Remaining', rateLimit.remaining)
    ctx.set('X-Rate-Limit-Reset', rateLimit.nextResetDate)

    k.info({ tags: ['request'] }, `Request by ${ctx.inet} to ${ctx.request.path}`, {
      'ip': ctx.inet,
      'path': ctx.request.path,
      'rate-limit-limit': rateLimit.total,
      'rate-limit-remaining': rateLimit.remaining,
      'query': ctx.query,
      'body': censor(ctx.data),
      'method': ctx.request.req.method
    })

    if (rateLimit.exceeded) {
      return next(p.template('rate_limit_exceeded'))
    }

    let result = await next()
    if (result === true) {
      ctx.status = 204
    } else if (result) {
      ctx.body = result
    }
  } catch (ex) {
    let error = ex
    if (!error.code) {
      error = p.template('server_error', error)
    }
    ctx.body = {
      errors: [error]
    }

    ctx.status = error.code
    if (error.code === SERVER_ERROR_CODE) {
      k.error(error)
      ctx.app.emit('error', ex, ctx)
    }
  }
})

g(d, {
  root: h.join(__dirname, 'views'),
  layout: false,
  viewExt: 'html',
  cache: false,
  debug: true
})

// ROUTES
// =============================================================================
c.get('/rescues', q.isAuthenticated, l.required(['rescue.read']), aa.search)
c.get('/rescues/:id', q.isAuthenticated, l.required(['rescue.read']), aa.findById)
c.post('/rescues', q.isAuthenticated, l.required(['rescue.write']), aa.create)
c.put('/rescues/:id', q.isAuthenticated, aa.update)
c.put('/rescues/assign/:id', q.isAuthenticated, aa.assign)
c.put('/rescues/addquote/:id', q.isAuthenticated, aa.assign)
c.put('/rescues/unassign/:id', q.isAuthenticated, aa.unassign)
c.delete('/rescues/:id', q.isAuthenticated, l.required(['rescue.delete']), aa.delete)


c.get('/clients', q.isAuthenticated, l.required(['client.read']), r.search)
c.get('/clients/:id', q.isAuthenticated, r.findById)
c.post('/clients', q.isAuthenticated, r.create)
c.put('/clients/:id', q.isAuthenticated, r.update)
c.delete('/clients/:id', q.isAuthenticated, l.required(['client.delete']), r.delete)


c.get('/users', q.isAuthenticated, l.required(['user.read']), ad.search)
c.get('/users/:id', q.isAuthenticated, ad.findById)
c.get('/users/image/:id', ad.image)
c.post('/users', q.isAuthenticated, ad.create)
c.put('/users/setpassword', q.isAuthenticated, ad.setpassword)
c.post('/users/image/:id', q.isAuthenticated, ad.setimage)
c.put('/users/:id/updatevirtualhost', q.isAuthenticated,
  l.required(['user.write']), ad.updatevirtualhost)
c.put('/users/:id', clean('image', 'password'), q.isAuthenticated, ad.update)
c.delete('/users/:id', q.isAuthenticated, l.required(['user.delete']), ad.delete)

c.get('/nicknames/info/:nickname', q.isAuthenticated, u.info)
c.get('/nicknames/:nickname', q.isAuthenticated, u.search)
c.post('/nicknames', q.isAuthenticated, u.register)
c.put('/nicknames', q.isAuthenticated, u.connect)
c.delete('/nicknames/:nickname', q.isAuthenticated, u.delete)


c.get('/rats', x.search)
c.get('/rats/:id', x.findById)
c.post('/rats', x.create)
c.put('/rats/:id', x.update)
c.delete('/rats/:id', l.required(['rat.delete']), x.delete)

c.get('/ships', ab.search)
c.get('/ships/:id', ab.findById)
c.post('/ships', fields('name', 'shipType', 'ratId'), clean('shipId'), ab.create)
c.put('/ships/:id', clean('shipId'), ab.update)
c.delete('/ships/:id', x.delete)

c.get('/welcome', (ctx) => {
  ctx.redirect('https://fuelrats.com/profile')
  ctx.status = 301
})

c.post('/login', fields('email', 'password'), t.login)
c.post('/register', fields('email', 'password', 'name', 'platform', 'nickname'),
  y.create)
c.get('/profile', q.isAuthenticated, l.required(['user.read.me']), w.read)

c.post('/anope', q.isWhitelisted, AnopeWebhook.update)

c.get('/oauth2/authorize',
  q.isAuthenticated,
  v.authorizationValidateFields,
  v.authorizationValidateRedirect,
  v.authorizationRender
)

c.post('/oauth2/authorize', q.isAuthenticated, ...v.server.decision())

// Create endpoint handlers for oauth2 token
c.post('/oauth2/token',
  q.isClientAuthenticated,
  v.server.token(),
  v.server.errorHandler())

c.post('/oauth2/revoke', q.isClientAuthenticated, v.revoke)
c.post('/oauth2/revokeall', q.isClientAuthenticated, v.revokeAll)

c.get('/statistics/rescues', ac.rescues)
c.get('/statistics/systems', ac.systems)
c.get('/statistics/rats', ac.rats)

c.get('/version', ae.read)
c.post('/reset', fields('email'), z.requestReset)
c.get('/reset/:token', z.validateReset)
c.post('/reset/:token', fields('password'), z.resetPassword)


c.get('/decals/check', q.isAuthenticated, s.check)
c.get('/decals/redeem', q.isAuthenticated, s.redeem)
c.post('/jira/drill', q.isAuthenticated, l.required(['user.write']), ag.update)

/*


router.get('/news', API.route(news.list))

router.get('/logout', logout.post)
router.post('/logout', logout.post)



router.post('/jira/drill', auth.isJiraAuthenticated(), Permission.required('user.update', false), jiraDrill.post)
router.post('/irc/message', auth.isAuthenticated(false), Permission.required('irc.oper', false), irc.message)
router.post('/irc/action', auth.isAuthenticated(false), Permission.required('irc.oper', false), irc.action)

 */


d.use(c.routes())
d.use(c.allowedMethods())


/**
 * Parses an object of URL query parameters and builds a nested object by delimiting periods into sub objects.
 * @param query an array of URL query parameters
 * @returns {{}} a nested object
 */
function parseQuery (query) {
  let queryObj = {}

  // Iterate over each individual query item
  for (let key of Object.keys(query)) {
    // Split them into period delimited arrays
    let keys = key.split('.')
    let target = queryObj

    // Iterate over the period delimited arrays to construct a nested hierarchy
    for (let keyPair of keys.entries()) {
      let [, subkey ] = keyPair
      if (keyPair[0] === keys.length - 1) {
        // We have reached the end of the delimited array which means we can insert the value

        target[subkey] = query[key]
      } else if (!target[subkey]) {
        /* We have not reached the end of the delimited array so we need to create a nested object unless
        it already exists */
        target[subkey] = {}
        target = target[subkey]
      }
    }
  }
  return queryObj
}

let server = i.createServer(d.callback())
const wss = new j.Server({ server })

const websocketManager = new af(wss, traffic)

wss.on('connection', async function connection (client) {
  let url = new URL(`http://localhost:8082${client.upgradeReq.url}`)
  client.clientId = m.sync(WEBSOCKET_IDENTIFIER_ROUNDS)
  client.subscriptions = []

  let bearer = url.searchParams.get('bearer')
  if (bearer) {
    let { user, scope } = await q.bearerAuthenticate(bearer)
    if (user) {
      client.user = user
      client.scope = scope
    }
  }

  websocketManager.onConnection(client)

  client.on('message', (message) => {
    client.websocket = wss
    try {
      let request = JSON.parse(message)
      websocketManager.onMessage(client, request)
    } catch (ex) {
      k.info('Failed to parse incoming websocket message')
    }
  })
})

/**
 * Goes through an object and sets properties commonly usde to hold sensitive information to a static value.
 * @param obj The object to censor
 * @returns {{}} A censored object
 */
function censor (obj) {
  let censoredObj = {}
  Object.assign(censoredObj, obj)

  if (censoredObj.password) {
    censoredObj.password = '[CENSORED]'
  }
  if (censoredObj.secret) {
    censoredObj.secret = '[CENSORED]'
  }

  return censoredObj
}

/**
 * Makes sure the request object has the required data fields specified
 * @param requiredFields The data fields to require
 * @returns {Function} A promise
 */
function fields (...requiredFields) {
  return async function (ctx, next) {
    let missingFields = requiredFields.filter((requiredField) => {
      return ctx.data.hasOwnProperty(requiredField) === false
    })
    if (missingFields.length > 0) {
      throw p.template('missing_required_fields', missingFields)
    }
    await next()
  }
}

/**
 * Removes the specified data fields from the request object
 * @param cleanFields The data fields to clean away
 * @returns {Function} A promise
 */
function clean (...cleanFields) {
  return async function (ctx, next) {
    if (Array.isArray(ctx.data) || typeof ctx.data === 'object') {
      cleanFields.map((cleanField) => {
        ctx.data[cleanField] = undefined
      })
    }
    await next()
  }
}

(async function startServer () {
  try {
    await db.sync()
    const listen = promisify(server.listen.bind(server))
    await listen(port, o.hostname)
    k.info(`HTTP Server listening on ${o.hostname} port ${port}`)
  } catch (error) {
    k.error(error)
  }
})()

// allow launch of app from unit tests
module.exports = server