import { Rescue, Rat, db } from '../db'
import DatabaseQuery from '../query2/Database'


import Rats from './Rats'
import {
  NotFoundAPIError,
  UnsupportedMediaAPIError
} from '../classes/APIError'

import API, {
  permissions,
  authenticated,
  GET,
  POST,
  PUT,
  PATCH,
  DELETE,
  parameters
} from '../classes/API'
import { websocket } from '../classes/WebSocket'
import RescueView from '../views/Rescue'
import DatabaseDocument from '../Documents/Database'

const rescueAccesstime = 3600000

export default class Rescues extends API {
  /**
   * @inheritdoc
   */
  get type () {
    return 'rescues'
  }

  @GET('/rescues')
  @websocket('rescues', 'search')
  @authenticated
  @permissions('rescue.read')
  async search (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await Rescue.findAndCountAll(query.searchObject)
    return new DatabaseDocument({ query, result, type: RescueView })
  }

  @GET('/rescues/:id')
  @websocket('rescues', 'read')
  @authenticated
  @permissions('rescue.read')
  async findById (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await Rescue.findOne({
      where: {
        id: ctx.params.id
      }
    })
    if (!result) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    return new DatabaseDocument({ query, result, type: RescueView })
  }

  @POST('/rescues')
  @websocket('rescues', 'create')
  @authenticated
  @permissions('rescue.write')
  async create (ctx) {
    const result = await super.create({ ctx, databaseType: Rescue })

    const query = new DatabaseQuery({ connection: ctx })
    ctx.response.status = 201
    return new DatabaseDocument({ query, result, type: RescueView })
  }

  @PUT('/rescues/:id')
  @websocket('rescues', 'update')
  @authenticated
  @parameters('id')
  async update (ctx) {
    const rescue = await super.update({ ctx, databaseType: Rescue, updateSearch: { userId: ctx.state.user.id } })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, rescue, type: RescueView })
  }

  @DELETE('/rescues/:id')
  @websocket('rescues', 'delete')
  @authenticated
  @permissions('rescue.delete')
  async delete (ctx) {
    await super.delete({ ctx, Rescue })

    ctx.response.status = 204
    return true
  }

  // relationships

  @GET('/rescues/:id/relationships/rats')
  @websocket('rescues', 'rats', 'read')
  @authenticated
  async relationshipRatsView (ctx) {
    const result = await this.relationshipView({
      ctx,
      databaseType: Rescue,
      relationship: 'rats'
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: RescueView, relationshipOnly: true })
  }

  @POST('/rescues/:id/relationships/rats')
  @websocket('rescues', 'rats', 'create')
  @authenticated
  async relationshipRatsCreate (ctx) {
    const result = await this.relationshipChange({
      ctx,
      databaseType: Rescue,
      change: 'add',
      relationship: 'rats'
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: RescueView, metaOnly: true })
  }

  @PATCH('/rescues/:id/relationships/rats')
  @websocket('rescues', 'rats', 'patch')
  @authenticated
  async relationshipRatsPatch (ctx) {
    const result = await this.relationshipChange({
      ctx,
      databaseType: Rescue,
      change: 'patch',
      relationship: 'rats'
    })

    const query = new DatabaseQuery({ connection: ctx })

    return new DatabaseDocument({ query, result, type: RescueView, metaOnly: true  })
  }

  @DELETE('/rescues/:id/relationships/rats')
  @websocket('rescues', 'rats', 'delete')
  @authenticated
  async relationshipRatsDelete (ctx) {
    const result = await this.relationshipChange({
      ctx,
      databaseType: Rescue,
      change: 'remove',
      relationship: 'rats'
    })

    const query = new DatabaseQuery({ connection: ctx })

    return new DatabaseDocument({ query, result, type: RescueView, metaOnly: true })
  }

  @GET('/rescues/:id/relationships/firstLimpet')
  @websocket('rescues', 'firstLimpet', 'read')
  @authenticated
  async relationshipfirstLimpetView (ctx) {
    const result = await this.relationshipView({
      ctx,
      databaseType: Rescue,
      relationship: 'firstLimpet'
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: RescueView, relationshipOnly: true })
  }

  @PATCH('/rescues/:id/relationships/firstLimpet')
  @websocket('rescues', 'firstLimpet', 'patch')
  @authenticated
  async relationshipFirstLimpetPatch (ctx) {
    const result = await this.relationshipChange({
      ctx,
      databaseType: Rescue,
      change: 'patch',
      relationship: 'firstLimpet'
    })

    const query = new DatabaseQuery({ connection: ctx })

    return new DatabaseDocument({ query, result, type: RescueView, metaOnly: true })
  }

  getWritePermissionFor ({ connection, entity }) {
    if (connection.state.user && entity.createdAt - Date.now() < rescueAccesstime) {
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

  changeRelationship ({ relationship }) {
    switch (relationship) {
      case 'rats':
        return {
          many: true,

          add ({ entity, ids }) {
            return entity.addRats(ids)
          },

          patch ({ entity, ids }) {
            return entity.setRats(ids)
          },

          remove ({ entity, ids }) {
            return entity.removeRats(ids)
          }
        }

      case 'firstLimpet':
        return {
          many: false,

          add ({ entity, id }) {
            return entity.addRat(id)
          },

          patch ({ entity, id }) {
            return entity.setRat(id)
          },

          remove ({ entity, id }) {
            return entity.removeRat(id)
          }
        }

      default:
        throw new UnsupportedMediaAPIError({ pointer: '/relationships' })
    }
  }

  get relationTypes () {
    return {
      'rats': 'rats',
      'firstLimpet': 'rats'
    }
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
