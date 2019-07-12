import DatabaseView from './Database'
import UserView from './User'
import { ReadPermission } from './index'

export default class ClientView extends DatabaseView {
  static get type () {
    return 'clients'
  }

  get attributes () {
    return {
      name: ReadPermission.all,
      redirectUri: ReadPermission.all,
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
      return this.query.connection.state.permissions.includes('client.read.me')
    }
    return false
  }

  get isGroup () {
    return this.query.connection.state.permissions.includes('client.read')
  }

  get isInternal () {
    return this.query.connection.state.permissions.includes('client.internal')
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
