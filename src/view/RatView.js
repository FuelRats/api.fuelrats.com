import DatabaseView from './DatabaseView'
import RescueView from './RescueView'
import ShipView from './ShipView'
import UserView from './UserView'
import { ReadPermission } from './View'

export default class RatView extends DatabaseView {
  static get type () {
    return 'rats'
  }

  get attributes () {
    return {
      name: ReadPermission.all,
      data: ReadPermission.all,
      platform: ReadPermission.all,
      frontierId: ReadPermission.group,
      createdAt: ReadPermission.all,
      updatedAt: ReadPermission.all,
      deletedAt: ReadPermission.internal
    }
  }

  get defaultReadPermission () {
    return ReadPermission.all
  }

  get isSelf () {
    if (this.query.connection.state.user && this.object.userId === this.query.connection.state.user.id) {
      return this.query.connection.state.permissions.includes('rat.read.me')
    }
    return false
  }

  get isGroup () {
    return this.query.connection.state.permissions.includes('rat.read')
  }

  get isInternal () {
    return this.query.connection.state.permissions.includes('rat.internal')
  }

  get relationships () {
    return {
      user: UserView,
      ships: ShipView
    }
  }

  get related () {
    return [RescueView, ShipView]
  }
}
