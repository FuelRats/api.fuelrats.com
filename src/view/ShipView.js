import { ReadPermission, DatabaseView, RatView } from './'

export default class ShipView extends DatabaseView {
  static get type () {
    return 'ships'
  }

  get attributes () {
    return class {
      static name
      static shipId
      static shipType
      static createdAt
      static updatedAt
      static deletedAt = ReadPermission.internal
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
