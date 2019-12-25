import Router from 'koa-router'
import config from '../config'
const router = new Router()

router.get('/welcome', (ctx) => {
  ctx.redirect(`${config.frontend.url}/profile`)
  ctx.status = 301
})

export default router

