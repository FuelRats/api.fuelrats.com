
import { Ship } from '../db'
import ShipQuery from '../Query/ShipQuery'
import { NotFoundAPIError } from '../APIError'
import APIEndpoint, {
  authenticated,
  GET,
  POST,
  PUT,
  DELETE,
  parameters,
  disallow,
  required
} from '../APIEndpoint'

export default class Ships extends APIEndpoint {
  @GET('/ships')
  async search (ctx) {
    let shipsQuery = new ShipQuery(ctx.query, ctx)
    let result = await Ship.findAndCountAll(shipsQuery.toSequelize)
    return Ships.presenter.render(result.rows, ctx.meta(result, shipsQuery))
  }

  @GET('/ships/:id')
  @parameters('id')
  async findById (ctx) {
    let shipsQuery = new ShipQuery({id: ctx.params.id}, ctx)
    let result = await Ship.findAndCountAll(shipsQuery.toSequelize)

    return Ships.presenter.render(result.rows, ctx.meta(result, shipsQuery))
  }

  @POST('/ships')
  @authenticated
  @required('name', 'shipType', 'ratId')
  @disallow('shipId')
  async create (ctx) {
    this.requireWritePermission(ctx, ctx.data)

    let result = await Ship.create(ctx.data)

    ctx.response.status = 201
    let renderedResult = Ships.presenter.render(result, ctx.meta(result))
    process.emit('shipCreated', ctx, renderedResult)
    return renderedResult
  }

  @PUT('/ships')
  @authenticated
  @disallow('shipId')
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

    let renderedResult = Ships.presenter.render(result.rows, ctx.meta(result, shipsQuery))
    process.emit('shipUpdated', ctx, renderedResult)
    return renderedResult
  }

  @DELETE('/ships/:id')
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
    class ShipsPresenter extends APIEndpoint.presenter {}
    ShipsPresenter.prototype.type = 'ships'
    return ShipsPresenter
  }
}
