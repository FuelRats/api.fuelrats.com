
import { Ship } from '../db'
import { NotFoundAPIError, UnsupportedMediaAPIError } from '../classes/APIError'
import API, {
  authenticated,
  GET,
  POST,
  PUT,
  DELETE,
  parameters,
  required,
  protect, WritePermission
} from '../classes/API'
import { websocket } from '../classes/WebSocket'
import DatabaseQuery from '../query/DatabaseQuery'
import DatabaseDocument from '../Documents/DatabaseDocument'
import ShipView from '../view/ShipView'
import StatusCode from '../classes/StatusCode'
import Permission from '../classes/Permission'

/**
 * Class managing Ship related endpoints
 */
export default class Ships extends API {
  /**
   * @inheritdoc
   */
  get type () {
    return 'ships'
  }

  /**
   * Search ships
   * @endpoint
   */
  @GET('/ships')
  @websocket('ships', 'search')
  async search (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await Ship.findAndCountAll(query.searchObject)
    return new DatabaseDocument({ result, query, type: ShipView })
  }

  /**
   * Get a ship by id
   * @endpoint
   */
  @GET('/ships/:id')
  @websocket('ships', 'read')
  @parameters('id')
  async findById (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await Ship.findOne({
      where: {
        id: ctx.params.id
      }
    })
    if (!result) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    return new DatabaseDocument({ query, result, type: ShipView })
  }

  /**
   * Create a ship
   * @endpoint
   */
  @POST('/ships')
  @websocket('ships', 'create')
  @authenticated
  @required('name', 'shipType', 'ratId')
  @protect('ship.write', 'shipId')
  async create (ctx) {
    const result = await super.create({ ctx, databaseType: Ship })

    const query = new DatabaseQuery({ connection: ctx })
    ctx.response.status = StatusCode.created
    return new DatabaseDocument({ query, result, type: ShipView })
  }

  /**
   * Update a ship
   * @endpoint
   */
  @PUT('/ships')
  @websocket('ships', 'update')
  @authenticated
  @protect('ship.write', 'shipId')
  async update (ctx) {
    const result = await super.update({ ctx, databaseType: Ship, updateSearch: { id:ctx.params.id } })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: ShipView })
  }

  /**
   * Delete a ship
   * @endpoint
   */
  @DELETE('/ships/:id')
  @websocket('ships', 'delete')
  @authenticated
  @parameters('id')
  async delete (ctx) {
    await super.delete({ ctx, databaseType: Ship })

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * @inheritdoc
   */
  get writePermissionsForFieldAccess () {
    return {
      name: WritePermission.group,
      shipType: WritePermission.group,
      shipId: WritePermission.internal,
      createdAt: WritePermission.internal,
      updatedAt: WritePermission.internal,
      deletedAt: WritePermission.internal
    }
  }

  /**
   * @inheritdoc
   */
  isInternal ({ ctx }) {
    return Permission.granted({ permissions: ['ships.internal'], connection: ctx })
  }

  /**
   * @inheritdoc
   */
  isGroup ({ ctx }) {
    return Permission.granted({ permissions: ['ships.write'], connection: ctx })
  }

  /**
   * @inheritdoc
   */
  isSelf ({ ctx, entity }) {
    const hasRat = ctx.state.user.rats.find((rat) => {
      return rat.id === entity.ratId
    })
    if (hasRat) {
      return Permission.granted({ permissions: ['ship.write.me'], connection: ctx })
    }
    return false
  }

  /**
   * @inheritdoc
   */
  changeRelationship ({ relationship }) {
    switch (relationship) {
      case 'rat':
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

  /**
   * @inheritdoc
   */
  get relationTypes () {
    return {
      'rat': 'rats'
    }
  }
}
