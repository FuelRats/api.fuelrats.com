import { ReadPermission, DatabaseView, RatView } from './'

export default class ShipView extends DatabaseView {
  static get type () {
    return 'ships'
  }

  get attributes () {
    return {
      name: ReadPermission.all,
      shipId: ReadPermission.all,
      shipType: ReadPermission.all,
      createdAt: ReadPermission.all,
      updatedAt: ReadPermission.all,
      deletedAt: ReadPermission.internal
    }
  }

  get defaultReadPermission () {
    return ReadPermission.all
  }

  get isSelf () {
    if (this.query.connection.state.user) {
      const ratExists = this.query.connection.state.user.rats.some((rat) => {
        return rat.id === this.ratId
      })
      if (ratExists) {
        return this.query.connection.state.permissions.includes('ships.read.me')
      }
    }
    return false
  }

  get isGroup () {
    return this.query.connection.state.permissions.includes('ships.read')
  }

  get isInternal () {
    return this.query.connection.state.permissions.includes('ships.internal')
  }

  get relationships () {
    return {
      rat: RatView
    }
  }

  get related () {
    return [RatView]
  }
}
