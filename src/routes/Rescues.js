

import { Rescue } from '../db'
import { CustomPresenter} from '../classes/Presenters'
import RescueQuery from '../query/RescueQuery'
import Rats from './Rats'
import Epics from './Epics'
import { NotFoundAPIError } from '../classes/APIError'

import BotServ from '../Anope/BotServ'
import API, {
  permissions,
  authenticated,
  GET,
  POST,
  PUT,
  DELETE,
  parameters,
  websocket
} from '../classes/API'

const RESCUE_ACCESS_TIME = 3600000

export default class Rescues extends API {
  constructor () {
    super()
  }

  @GET('/rescues')
  @websocket('rescues', 'search')
  @authenticated
  @permissions('rescue.read')
  async search (ctx) {
    let rescueQuery = new RescueQuery(ctx.query, ctx)
    let result = await Rescue.scope('rescue').findAndCountAll(rescueQuery.toSequelize)
    return Rescues.presenter.render(result.rows, ctx.meta(result, rescueQuery))
  }

  @GET('/rescues/:id')
  @websocket('rescues', 'read')
  @authenticated
  @permissions('rescue.read')
  @parameters('id')
  async findById (ctx) {
    let rescueQuery = new RescueQuery({ id: ctx.params.id }, ctx)
    let result = await Rescue.scope('rescue').findAndCountAll(rescueQuery.toSequelize)
    return Rescues.presenter.render(result.rows, ctx.meta(result, rescueQuery))
  }

  @POST('/rescues')
  @websocket('rescues', 'create')
  @authenticated
  @permissions('rescue.write')
  async create (ctx) {
    let result = await Rescue.scope('rescue').create(ctx.data)

    ctx.response.status = 201
    let rescue = Rescues.presenter.render(result, ctx.meta(result))
    process.emit('rescueCreated', ctx, rescue)
    return rescue
  }

  @PUT('/rescues/:id')
  @websocket('rescues', 'update')
  @authenticated
  @parameters('id')
  async update (ctx) {
    let rescue = await Rescue.scope('rescue').findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!rescue) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission(ctx, rescue)

    await Rescue.scope('rescue').update(ctx.data, {
      where: {
        id: ctx.params.id
      }
    })

    let rescueQuery = new RescueQuery({id: ctx.params.id}, ctx)
    let result = await Rescue.scope('rescue').findAndCountAll(rescueQuery.toSequelize)
    let renderedResult = Rescues.presenter.render(result.rows, ctx.meta(result, rescueQuery))
    process.emit('rescueUpdated', ctx, renderedResult, null, ctx.data)
    return renderedResult
  }

  @DELETE('/rescues/:id')
  @websocket('rescues', 'delete')
  @authenticated
  @permissions('rescue.delete')
  @parameters('id')
  async delete (ctx) {
    let rescue = await Rescue.scope('rescue').findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!rescue) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    rescue.destroy()

    process.emit('rescueDeleted', ctx, CustomPresenter.render({
      id: ctx.params.id
    }, {}))
    ctx.status = 204
    return true
  }

  @PUT('/rescues/assign/:id')
  @authenticated
  @parameters('id')
  async assign (ctx) {
    if (Array.isArray(ctx.data) === false && ctx.data.hasOwnProperty('data')) {
      ctx.data = ctx.data.data
    }

    let rescue = await Rescue.scope('rescue').findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!rescue) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission(ctx, rescue)

    let rats = ctx.data.map((rat) => {
      return rescue.addRat(rat)
    })

    await Promise.all(rats)

    let rescueQuery = new RescueQuery({ id: ctx.params.id }, ctx)
    let result = await Rescue.scope('rescue').findAndCountAll(rescueQuery.toSequelize)
    let renderedResult = Rescues.presenter.render(result.rows, ctx.meta(result, rescueQuery))
    process.emit('rescueUpdated', ctx, renderedResult)
    return renderedResult
  }

  @PUT('/rescues/unassign/:id')
  @authenticated
  @parameters('id')
  async unassign (ctx) {
    if (Array.isArray(ctx.data) === false && ctx.data.hasOwnProperty('data')) {
      ctx.data = ctx.data.data
    }

    let rescue = await Rescue.scope('rescue').findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!rescue) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission(ctx, rescue)

    let rats = ctx.data.map((rat) => {
      return rescue.removeRat(rat)
    })

    await Promise.all(rats)

    let rescueQuery = new RescueQuery({ id: ctx.params.id }, ctx)
    let result = await Rescue.scope('rescue').findAndCountAll(rescueQuery.toSequelize)
    let renderedResult = Rescues.presenter.render(result.rows, ctx.meta(result, rescueQuery))
    process.emit('rescueUpdated', ctx, renderedResult)
    return renderedResult
  }

  @PUT('/rescues/addquote/:id')
  @authenticated
  @parameters('id')
  async addquote (ctx) {
    if (Array.isArray(ctx.data) === false && ctx.data.hasOwnProperty('data')) {
      ctx.data = ctx.data.data
    }

    let rescue = await Rescue.scope('rescue').findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!rescue) {
      throw NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission(ctx, rescue)

    await Rescue.update({
      quotes: rescue.quotes.concat(ctx.data)
    }, {
      where: {
        id: ctx.params.id
      }
    })

    let rescueQuery = new RescueQuery({ id: ctx.params.id }, ctx)
    let result = await Rescue.scope('rescue').findAndCountAll(rescueQuery.toSequelize)
    let renderedResult = Rescues.presenter.render(result.rows, ctx.meta(result, rescueQuery))
    process.emit('rescueUpdated', ctx, renderedResult)
    return renderedResult
  }

  getWritePermissionForEntity (ctx, entity) {
    if (ctx.state.user && entity.createdAt - Date.now() < RESCUE_ACCESS_TIME) {
      for (let rat of ctx.state.user.data.relationships.rats.data) {
        if (entity.rats.find((fRat) => { return fRat.id === rat.id }) || entity.firstLimpetId === rat.id) {
          return ['rescue.write.me', 'rescue.write']
        }
      }
    }
    return ['rescue.write']
  }

  static get presenter () {
    class RescuesPresenter extends API.presenter {
      relationships () {
        return {
          rats: Rats.presenter,
          firstLimpet: Rats.presenter,
          epics: Epics.presenter
        }
      }

      selfLinks (instance) {
        return `/rescues/${this.id(instance)}`
      }

      links (instance) {
        return {
          rescues: {
            self: this.selfLinks(instance),
            related: this.selfLinks(instance)
          }
        }
      }
    }
    RescuesPresenter.prototype.type = 'rescues'
    return RescuesPresenter
  }
}

process.on('rescueCreated', (ctx, rescue) => {
  if (!rescue.system) {
    return
  }
  if (rescue.system.includes('NLTT 48288') || rescue.system.includes('MCC 811')) {
    BotServ.say('#ratchat', 'DRINK!')
  }
})

process.on('rescueUpdated', (ctx, result, permissions, changedValues) => {
  if (!changedValues) {
    return
  }
  if (changedValues.hasOwnProperty('outcome')) {
    let { boardIndex } = result.data[0].attributes.data || {}
    let caseNumber = boardIndex || boardIndex === 0 ? `#${boardIndex}` : result.data[0].id

    let client = result.data[0].attributes.client || ''
    let author = ctx.state.user.data.attributes.nicknames[0] || ctx.state.user.data.id
    if (ctx.req && ctx.req.headers.hasOwnProperty('x-command-by')) {
      author = ctx.req.headers['x-command-by']
    }
    BotServ.say('#ratchat',
      `[Paperwork] Paperwork for rescue ${caseNumber} (${client}) has been completed by ${author}`)
  }
})