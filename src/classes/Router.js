import Router from 'koa-router'

let router = new Router()

router.get('/welcome', (ctx) => {
  ctx.redirect('https://fuelrats.com/profile')
  ctx.status = 301
})

export default router

