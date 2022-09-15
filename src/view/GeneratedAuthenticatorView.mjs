import DatabaseView from './DatabaseView'
import UserView from './UserView'
import { ReadPermission } from './View'

/**
 * JSONAPI View for a generated 2 factor Authenticator secret
 */
export default class GeneratedAuthenticatorView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'generated-authenticators'
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return {
      secret: ReadPermission.self,
      dataUri: ReadPermission.self,
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
    if (this.query.connection.state.user && this.object.user.id === this.query.connection.state.user.id) {
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
