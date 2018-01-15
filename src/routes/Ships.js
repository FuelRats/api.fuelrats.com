
import { Ship } from '../db'
import ShipQuery from '../query/ShipQuery'
import { NotFoundAPIError } from '../classes/APIError'
import API, {
  authenticated,
  GET,
  POST,
  PUT,
  DELETE,
  parameters,
  disallow,
  required,
  protect
} from '../classes/API'
import { websocket } from '../classes/WebSocket'

export default class Ships extends API {
  @GET('/ships')
  @websocket('ships', 'search')
  async search (ctx) {
    let shipsQuery = new ShipQuery(ctx.query, ctx)
    let result = await Ship.findAndCountAll(shipsQuery.toSequelize)
    return Ships.presenter.render(result.rows, API.meta(result, shipsQuery))
  }

  @GET('/ships/:id')
  @websocket('ships', 'read')
  @parameters('id')
  async findById (ctx) {
    let shipsQuery = new ShipQuery({id: ctx.params.id}, ctx)
    let result = await Ship.findAndCountAll(shipsQuery.toSequelize)

    return Ships.presenter.render(result.rows, API.meta(result, shipsQuery))
  }

  @POST('/ships')
  @websocket('ships', 'create')
  @authenticated
  @required('name', 'shipType', 'ratId')
  @protect('ship.write', 'shipId')
  async create (ctx) {
    this.requireWritePermission(ctx, ctx.data)

    let result = await Ship.create(ctx.data)

    ctx.response.status = 201
    let renderedResult = Ships.presenter.render(result, API.meta(result))
    process.emit('shipCreated', ctx, renderedResult)
    return renderedResult
  }

  @PUT('/ships')
  @websocket('ships', 'update')
  @authenticated
  @protect('ship.write', 'shipId')
  async update (ctx) {
    this.requireWritePermission(ctx, ctx.data)

    let ship = await Ship.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!ship) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission(ctx, ship)

    await Ship.update(ctx.data, {
      where: {
        id: ctx.params.id
      }
    })

    let shipsQuery = new ShipQuery({id: ctx.params.id}, ctx)
    let result = await Ship.findAndCountAll(shipsQuery.toSequelize)

    let renderedResult = Ships.presenter.render(result.rows, API.meta(result, shipsQuery))
    process.emit('shipUpdated', ctx, renderedResult)
    return renderedResult
  }

  @DELETE('/ships/:id')
  @websocket('ships', 'delete')
  @authenticated
  @parameters('id')
  async delete (ctx) {
    let ship = await Ship.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!ship) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission(ctx, ship)

    await ship.destroy()
    return true
  }

  getWritePermissionForEntity (ctx, entity) {
    let rat = ctx.state.user.included.find((included) => {
      return included.id === entity.ratId
    })

    if (rat) {
      return ['ship.write.me', 'ship.write']
    } else {
      return ['ship.write.me']
    }
  }

  static get presenter () {
    class ShipsPresenter extends API.presenter {}
    ShipsPresenter.prototype.type = 'ships'
    return ShipsPresenter
  }
}
