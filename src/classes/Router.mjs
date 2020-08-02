import Router from 'koa-router'
import config from '../config'
import StatusCode from './StatusCode'

const router = new Router()
const documentationUrl = 'https://github.com/FuelRats/FuelRats-API-Docs/blob/master/beta.md'

router.get('/', (ctx) => {
  ctx.redirect(documentationUrl)
  ctx.status = StatusCode.seeOther
})

router.get('/welcome', (ctx) => {
  ctx.redirect(`${config.frontend.url}/profile`)
  ctx.status = StatusCode.movedPermanently
})

export default router

