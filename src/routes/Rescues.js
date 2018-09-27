

import { Rescue, Rat } from '../db'
import { CustomPresenter} from '../classes/Presenters'
import RescueQuery from '../query/rescue'
import Rats from './Rats'
import Epics from './Epics'
import {ForbiddenAPIError, GoneAPIError, NotFoundAPIError} from '../classes/APIError'

import BotServ from '../Anope/BotServ'
import API, {
  permissions,
  authenticated,
  GET,
  POST,
  PUT,
  DELETE,
  parameters
} from '../classes/API'
import { websocket } from '../classes/WebSocket'

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
    let rescueQuery = new RescueQuery({ params: ctx.query, connection: ctx })
    let result = await Rescue.scope('rescue').findAndCountAll(rescueQuery.toSequelize)
    return Rescues.presenter.render(result.rows, API.meta(result, rescueQuery))
  }

  @GET('/rescues/:id')
  @websocket('rescues', 'read')
  @authenticated
  @permissions('rescue.read')
  @parameters('id')
  async findById (ctx) {
    let rescueQuery = new RescueQuery({ params: { id: ctx.params.id }, connection: ctx })
    let result = await Rescue.scope('rescue').findAndCountAll(rescueQuery.toSequelize)
    return Rescues.presenter.render(result.rows, API.meta(result, rescueQuery))
  }

  @POST('/rescues')
  @websocket('rescues', 'create')
  @authenticated
  @permissions('rescue.write')
  async create (ctx) {
    let result = await Rescue.scope('rescue').create(ctx.data, {
      userId: ctx.state.user.id
    })

    ctx.response.status = 201
    let rescue = Rescues.presenter.render(result, API.meta(result))
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

    this.requireWritePermission({ connection: ctx, entity: rescue })

    await rescue.update(ctx.data, {
      userId: ctx.state.user.id
    })

    let rescueQuery = new RescueQuery({ params: {id: ctx.params.id}, connection: ctx })
    let result = await Rescue.scope('rescue').findAndCountAll(rescueQuery.toSequelize)
    let renderedResult = Rescues.presenter.render(result.rows, API.meta(result, rescueQuery))
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

    await rescue.destroy()

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

    this.requireWritePermission({ connection: ctx, entity: rescue })

    let rats = await Promise.all(ctx.data.map((ratId) => {
      return Rat.scope('internal').findOne({ where: { id: ratId } })
    }))

    for (let rat of rats) {
      if (rat.user.isSuspended()) {
        process.emit('suspendedAssign', ctx, rat)
        throw new ForbiddenAPIError({ pointer: `/data/${rat.id}` })
      }

      if (rat.user.isDeactivated()) {
        throw new GoneAPIError({ pointer: `/data/${rat.id}` })
      }
    }

    await rescue.addRats(rats)

    let rescueQuery = new RescueQuery({ params: { id: ctx.params.id }, connection: ctx })
    let result = await Rescue.scope('rescue').findAndCountAll(rescueQuery.toSequelize)
    let renderedResult = Rescues.presenter.render(result.rows, API.meta(result, rescueQuery))
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

    let rescueQuery = new RescueQuery({ params: { id: ctx.params.id }, connection: ctx })
    let result = await Rescue.scope('rescue').findAndCountAll(rescueQuery.toSequelize)
    let renderedResult = Rescues.presenter.render(result.rows, API.meta(result, rescueQuery))
    process.emit('rescueUpdated', ctx, renderedResult)
    return renderedResult
  }

  getWritePermissionFor ({ connection, entity }) {
    if (connection.state.user && entity.createdAt - Date.now() < RESCUE_ACCESS_TIME) {
      for (let rat of connection.state.user.rats) {
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
    BotServ.say(global.PAPERWORK_CHANNEL, 'DRINK!')
  }
})

process.on('rescueUpdated', async (ctx, result, permissions, changedValues) => {
  if (!changedValues) {
    return
  }
  if (changedValues.hasOwnProperty('outcome')) {
    let { boardIndex } = result.data[0] || {}
    let caseNumber = boardIndex || boardIndex === 0 ? `#${boardIndex}` : result.data[0].id

    let client = result.data[0].client || ''
    let author = await API.getAuthor(ctx).preferredRat().name
    BotServ.say(global.PAPERWORK_CHANNEL,
      `[Paperwork] Paperwork for rescue ${caseNumber} (${client}) has been completed by ${author.preferredRat().name}`)
  }
})


process.on('suspendedAssign', async (ctx, rat) => {
  let author = await API.getAuthor(ctx)
  BotServ.say(global.MODERATOR_CHANNEL,
    `[API] Attempt to assign suspended rat ${rat.name} (${rat.id}) by ${author.preferredRat().name}`)
})
