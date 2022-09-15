import DatabaseView from './DatabaseView'
import UserView from './UserView'
import { ReadPermission } from './View'

/**
 * JSONAPI View for a 2 factor Authenticator
 */
export default class AuthenticatorView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'authenticators'
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return {
      description: ReadPermission.self,
      secret: ReadPermission.internal,
      createdAt: ReadPermission.self,
      updatedAt: ReadPermission.self,
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
    return ['user']
  }
}
