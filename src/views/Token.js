import DatabaseView from './Database'
import UserView from './User'
import { ReadPermission } from './index'

export default class TokenView extends DatabaseView {
  static get type () {
    return 'tokens'
  }

  get attributes () {
    return {
      value: ReadPermission.self,
      scope: ReadPermission.group,
      createdAt: ReadPermission.all,
      updatedAt: ReadPermission.all,
      deletedAt: ReadPermission.internal
    }
  }

  get defaultReadPermission () {
    return ReadPermission.self
  }

  get isSelf () {
    if (this.query.connection.state.user && this.object.userId === this.query.connection.state.user.id) {
      return this.query.connection.state.permissions.includes('user.read.me')
    }
    return false
  }

  get isGroup () {
    return this.query.connection.state.permissions.includes('user.read')
  }

  get isInternal () {
    return this.query.connection.state.permissions.includes('user.internal')
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
