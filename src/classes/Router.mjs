import Router from 'koa-router'
import config from '../config'
import StatusCode from './StatusCode'

const router = new Router()

router.get('/', (ctx) => {
  const configuration = {
    theme: 'purple',
    layout: 'modern',
    showSidebar: true,
    hideDownloadButton: false,
    searchHotKey: 'k',
    darkMode: false,
    authentication: {
      preferredSecurityScheme: 'bearerAuth',
    },
  }

  const html = `<!doctype html>
<html>
  <head>
    <title>FuelRats API Documentation</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <div id="api-reference"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#api-reference', {
        url: './openapi/bundled.yaml',
        ...${JSON.stringify(configuration)}
      })
    </script>
  </body>
</html>`

  ctx.type = 'text/html'
  ctx.body = html
})

router.get('/openapi/bundled.yaml', async (ctx) => {
  const fs = await import('fs/promises')
  const path = await import('path')

  try {
    const bundledPath = path.resolve('docs/openapi/bundled.yaml')
    const bundled = await fs.readFile(bundledPath, 'utf8')
    ctx.type = 'application/x-yaml'
    ctx.body = bundled
  } catch (error) {
    ctx.status = 404
    ctx.body = { error: 'Bundled OpenAPI specification not found' }
  }
})

router.get('/openapi/openapi.yaml', async (ctx) => {
  const fs = await import('fs/promises')
  const path = await import('path')

  try {
    const specPath = path.resolve('docs/openapi/openapi.yaml')
    const spec = await fs.readFile(specPath, 'utf8')
    ctx.type = 'application/x-yaml'
    ctx.body = spec
  } catch (error) {
    ctx.status = 404
    ctx.body = { error: 'OpenAPI specification not found' }
  }
})

router.get('/welcome', (ctx) => {
  ctx.redirect(`${config.frontend.url}/profile`)
  ctx.status = StatusCode.movedPermanently
})

export default router

