import { ReadPermission, DatabaseView, RescueView, ShipView, UserView } from './'

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
      return this.query.connection.state.permissions.includes('rats.read.me')
    }
    return false
  }

  get isGroup () {
    return this.query.connection.state.permissions.includes('rats.read')
  }

  get isInternal () {
    return this.query.connection.state.permissions.includes('rats.internal')
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
