import { ReadPermission, DatabaseView, UserView } from './'

export default class DecalView extends DatabaseView {
  static get type () {
    return 'decals'
  }

  get attributes () {
    return class {
      static code
      static type
      static notes
      static createdAt
      static updatedAt
      static deletedAt = ReadPermission.internal
    }
  }

  get defaultReadPermission () {
    return ReadPermission.group
  }

  get isSelf () {
    if (this.query.connection.state.user && this.object.userId === this.query.connection.state.user.id) {
      return this.query.connection.state.permissions.includes('decals.read.me')
    }
    return false
  }

  get isGroup () {
    return this.query.connection.state.permissions.includes('decals.read')
  }

  get isInternal () {
    return this.query.connection.state.permissions.includes('decals.internal')
  }

  get relationships () {
    return {
      user: UserView
    }
  }

  get includes () {
    return []
  }
}
