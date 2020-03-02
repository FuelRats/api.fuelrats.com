import DatabaseView from './DatabaseView'
import UserView from './UserView'
import { ReadPermission } from './View'

/**
 * Get JSONAPI view for an oauth token
 */
export default class TokenView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'tokens'
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return {
      value: ReadPermission.self,
      scope: ReadPermission.group,
      createdAt: ReadPermission.all,
      updatedAt: ReadPermission.all,
      deletedAt: ReadPermission.internal,
    }
  }

  /**
   * @inheritdoc
   */
  get defaultReadPermission () {
    return ReadPermission.self
  }

  /**
   * @inheritdoc
   */
  get isSelf () {
    if (this.query.connection.state.user && this.object.userId === this.query.connection.state.user.id) {
      return this.query.connection.state.permissions.includes('users.read.me')
    }
    return false
  }

  /**
   * @inheritdoc
   */
  get isGroup () {
    return this.query.connection.state.permissions.includes('users.read')
  }

  /**
   * @inheritdoc
   */
  get isInternal () {
    return this.query.connection.state.permissions.includes('users.internal')
  }

  /**
   * @inheritdoc
   */
  get relationships () {
    return {
      user: UserView,
    }
  }

  /**
   * @inheritdoc
   */
  get includes () {
    return []
  }
}
