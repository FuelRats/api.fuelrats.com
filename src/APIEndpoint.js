
import Permission from './permission'
import { ForbiddenAPIError } from './APIError'
import yayson from 'yayson'

/**
 * @class
 * Base class for FuelRats API endpoints
 */
class APIEndpoint {
  getReadPermissionForEntity () {
    return []
  }

  getWritePermissionForEntity () {
    return []
  }

  hasReadPermission (ctx, entity) {
    return Permission.granted(this.getReadPermissionForEntity(ctx, entity), ctx.state.user, ctx.state.scope)
  }

  hasWritePermission (ctx, entity) {
    return Permission.granted(this.getWritePermissionForEntity(ctx, entity), ctx.state.user, ctx.state.scope)
  }

  requireReadPermission (ctx, entity) {
    if (!this.hasReadPermission(ctx, entity)) {
      throw new ForbiddenAPIError({})
    }
  }

  requireWritePermission (ctx, entity) {
    if (!this.hasWritePermission(ctx, entity)) {
      throw new ForbiddenAPIError({})
    }
  }

  static get presenter () {
    return yayson({
      adapter: 'sequelize'
    }).Presenter
  }
}

module.exports = APIEndpoint