import { ReadPermission, DatabaseView, UserView } from './'

export default class GroupView extends DatabaseView {
  static get type () {
    return 'groups'
  }

  get attributes () {
    return class {
      static vhost
      static withoutPrefix
      static priority
      static permissions
      static createdAt
      static updatedAt
      static deletedAt = ReadPermission.internal
    }
  }

  get defaultReadPermission () {
    return ReadPermission.group
  }

  get isSelf () {
    if (this.query.connection.state.user && this.object.UserGroups.userId === this.query.connection.state.user.id) {
      return this.query.connection.state.permissions.includes('group.read.me')
    }
    return false
  }

  get isGroup () {
    return this.query.connection.state.permissions.includes('group.read')
  }

  get isInternal () {
    return this.query.connection.state.permissions.includes('group.internal')
  }

  get related () {
    return [UserView]
  }
}
