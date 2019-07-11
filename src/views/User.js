import DatabaseView from './Database'
import RatView from './Rat'
import GroupView from './Group'
import ClientView from './Client'
import { ReadPermission } from './index'

export default class UserView extends DatabaseView {
  static get type () {
    return 'users'
  }

  get attributes () {
    return class {
      static data
      static email
      static status
      static suspended
      static createdAt
      static updatedAt
      static deletedAt = ReadPermission.internal
    }
  }

  get defaultReadPermission () {
    return ReadPermission.group
  }

  get isSelf () {
    if (this.query.connection.state.user && this.object.id === this.query.connection.state.user.id) {
      return this.query.permissions.includes('user.read.me')
    }
    return false
  }

  get isGroup () {
    return this.query.permissions.includes('user.read')
  }

  get isInternal () {
    return this.query.permissions.includes('user.internal')
  }

  get relationships () {
    return {
      rats: RatView,
      displayRat: RatView,
      groups: GroupView,
      clients: ClientView
    }
  }

  get includes () {
    return ['rats', 'displayRat', 'groups', 'clients']
  }
}
