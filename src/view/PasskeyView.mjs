import DatabaseView from './DatabaseView'
import UserView from './UserView'
import { ReadPermission } from './View'

/**
 * JSONAPI View for a WebAuthn/Passkey credential
 */
export default class PasskeyView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'passkeys'
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return {
      credentialId: ReadPermission.internal,
      publicKey: ReadPermission.internal,
      counter: ReadPermission.internal,
      name: ReadPermission.self,
      backedUp: ReadPermission.self,
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
