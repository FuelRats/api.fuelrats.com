import DatabaseView from './DatabaseView'
import UserView from './UserView'
import { ReadPermission } from './View'

/**
 * JSONAPI view for a user session
 */
export default class SessionView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'sessions'
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return {
      ip: ReadPermission.self,
      userAgent: ReadPermission.self,
      lastAccess: ReadPermission.self,
      verified: ReadPermission.self,
      current: ReadPermission.self,
      createdAt: ReadPermission.self,
      updatedAt: ReadPermission.self,
      fingerprint: ReadPermission.internal,
      code: ReadPermission.internal,
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
