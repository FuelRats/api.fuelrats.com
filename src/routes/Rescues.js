

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
import Document from '../classes/Document'
import RescueView from '../views/Rescue'

const RESCUE_ACCESS_TIME = 3600000

export default class Rescues extends API {
  @GET('/rescues')
  @websocket('rescues', 'search')
  @authenticated
  @permissions('rescue.read')
  async search (ctx) {
    const rescueQuery = new RescueQuery({ params: ctx.query, connection: ctx })
    const result = await Rescue.scope('rescue').findAndCountAll(rescueQuery.toSequelize)
    // return Rescues.presenter.render(result.rows, API.meta(result, rescueQuery))
    return new Document({ objects: result.rows, type: RescueView, meta: API.meta(result, rescueQuery) })
  }

  @GET('/rescues/:id')
  @websocket('rescues', 'read')
  @authenticated
  @permissions('rescue.read')
  @parameters('id')
  async findById (ctx) {
    const rescueQuery = new RescueQuery({ params: { id: ctx.params.id }, connection: ctx })
    const result = await Rescue.scope('rescue').findAndCountAll(rescueQuery.toSequelize)
    return Rescues.presenter.render(result.rows, API.meta(result, rescueQuery))
  }

  @POST('/rescues')
  @websocket('rescues', 'create')
  @authenticated
  @permissions('rescue.write')
  async create (ctx) {
    const result = await Rescue.scope('rescue').create(ctx.data, {
      userId: ctx.state.user.id
    })

    ctx.response.status = 201
    const rescue = Rescues.presenter.render(result, API.meta(result))
    process.emit('rescueCreated', ctx, rescue)
    return rescue
  }

  @PUT('/rescues/:id')
  @websocket('rescues', 'update')
  @authenticated
  @parameters('id')
  async update (ctx) {
    const rescue = await Rescue.scope('rescue').findOne({
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

    const rescueQuery = new RescueQuery({ params: {id: ctx.params.id}, connection: ctx })
    const result = await Rescue.scope('rescue').findAndCountAll(rescueQuery.toSequelize)
    const renderedResult = Rescues.presenter.render(result.rows, API.meta(result, rescueQuery))
    process.emit('rescueUpdated', ctx, renderedResult, null, ctx.data)
    return renderedResult
  }

  @DELETE('/rescues/:id')
  @websocket('rescues', 'delete')
  @authenticated
  @permissions('rescue.delete')
  @parameters('id')
  async delete (ctx) {
    const rescue = await Rescue.scope('rescue').findOne({
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

    const rescue = await Rescue.scope('rescue').findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!rescue) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission({ connection: ctx, entity: rescue })

    const rats = await Promise.all(ctx.data.map((ratId) => {
      return Rat.scope('internal').findOne({ where: { id: ratId } })
    }))

    for (const rat of rats) {
      if (rat.user.isSuspended()) {
        process.emit('suspendedAssign', ctx, rat)
        throw new ForbiddenAPIError({ pointer: `/data/${rat.id}` })
      }

      if (rat.user.isDeactivated()) {
        throw new GoneAPIError({ pointer: `/data/${rat.id}` })
      }
    }

    await rescue.addRats(rats)

    const rescueQuery = new RescueQuery({ params: { id: ctx.params.id }, connection: ctx })
    const result = await Rescue.scope('rescue').findAndCountAll(rescueQuery.toSequelize)
    const renderedResult = Rescues.presenter.render(result.rows, API.meta(result, rescueQuery))
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

    const rescue = await Rescue.scope('rescue').findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!rescue) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission(ctx, rescue)

    const rats = ctx.data.map((rat) => {
      return rescue.removeRat(rat)
    })

    await Promise.all(rats)

    const rescueQuery = new RescueQuery({ params: { id: ctx.params.id }, connection: ctx })
    const result = await Rescue.scope('rescue').findAndCountAll(rescueQuery.toSequelize)
    const renderedResult = Rescues.presenter.render(result.rows, API.meta(result, rescueQuery))
    process.emit('rescueUpdated', ctx, renderedResult)
    return renderedResult
  }

  getWritePermissionFor ({ connection, entity }) {
    if (connection.state.user && entity.createdAt - Date.now() < RESCUE_ACCESS_TIME) {
      for (const rat of connection.state.user.rats) {
        const isAssist = entity.rats.find((fRat) => {
          return fRat.id === rat.id
        })
        if (isAssist || entity.firstLimpetId === rat.id) {
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

process.on('rescueUpdated', async (ctx, result, perms, changedValues) => {
  if (!changedValues) {
    return
  }
  if (changedValues.hasOwnProperty('outcome')) {
    const { boardIndex } = result.data[0] || {}
    const caseNumber = boardIndex || boardIndex === 0 ? `#${boardIndex}` : result.data[0].id

    const client = result.data[0].client || ''
    const author = await API.getAuthor(ctx).preferredRat().name
    BotServ.say(global.PAPERWORK_CHANNEL,
      `[Paperwork] Paperwork for rescue ${caseNumber} (${client}) has been completed by ${author.preferredRat().name}`)
  }
})


process.on('suspendedAssign', async (ctx, rat) => {
  const author = await API.getAuthor(ctx)
  BotServ.say(global.MODERATOR_CHANNEL,
    `[API] Attempt to assign suspended rat ${rat.name} (${rat.id}) by ${author.preferredRat().name}`)
})
