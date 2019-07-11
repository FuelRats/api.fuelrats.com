import DatabaseView from './Database'
import RescueView from './Rescue'
import ShipView from './Ship'
import UserView from './User'
import { ReadPermission } from './index'

export default class RatView extends DatabaseView {
  static get type () {
    return 'rats'
  }

  get attributes () {
    return {
      name: ReadPermission.all,
      data: ReadPermission.all,
      platform: ReadPermission.all,
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
      return this.query.permissions.includes('rat.read.me')
    }
    return false
  }

  get isGroup () {
    return this.query.permissions.includes('rat.read')
  }

  get isInternal () {
    return this.query.permissions.includes('rat.internal')
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
