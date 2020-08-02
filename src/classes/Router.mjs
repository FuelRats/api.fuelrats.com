import Router from 'koa-router'
import config from '../config'
import StatusCode from './StatusCode'

const router = new Router()

router.get('/', (ctx) => {
  ctx.redirect(config.documentationUrl)
  ctx.status = StatusCode.seeOther
})

router.get('/welcome', (ctx) => {
  ctx.redirect(`${config.frontend.url}/profile`)
  ctx.status = StatusCode.movedPermanently
})

export default router

