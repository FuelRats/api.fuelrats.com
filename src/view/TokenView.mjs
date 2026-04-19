import ClientView from './ClientView'
import DatabaseView from './DatabaseView'
import UserView from './UserView'
import { ReadPermission } from './View'

/**
 * Get JSONAPI view for an oauth token (used as session representation)
 */
export default class TokenView extends DatabaseView {
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
      scope: ReadPermission.self,
      ipAddress: ReadPermission.self,
      userAgent: ReadPermission.self,
      authMethod: ReadPermission.self,
      lastAccess: ReadPermission.self,
      createdAt: ReadPermission.self,
      updatedAt: ReadPermission.self,
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
  get meta () {
    return {
      current: this.object.dataValues.current ?? false,
    }
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
      client: ClientView,
    }
  }

  /**
   * @inheritdoc
   */
  get includes () {
    return ['client']
  }
}
