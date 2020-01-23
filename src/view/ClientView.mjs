import { ReadPermission } from './View'
import DatabaseView from './DatabaseView'
import UserView from './UserView'

/**
 * JSONAPI View for an OAuth client
 */
export default class ClientView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'clients'
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return {
      name: ReadPermission.all,
      redirectUri: ReadPermission.all,
      namespaces: ReadPermission.all,
      firstParty: ReadPermission.all,
      createdAt: ReadPermission.all,
      updatedAt: ReadPermission.all,
      deletedAt: ReadPermission.internal
    }
  }

  /**
   * @inheritdoc
   */
  get defaultReadPermission () {
    return ReadPermission.all
  }

  /**
   * @inheritdoc
   */
  get isSelf () {
    if (this.query.connection.state.user && this.object.userId === this.query.connection.state.user.id) {
      return this.query.connection.state.permissions.includes('clients.read.me')
    }
    return false
  }

  /**
   * @inheritdoc
   */
  get isGroup () {
    return this.query.connection.state.permissions.includes('clients.read')
  }

  /**
   * @inheritdoc
   */
  get isInternal () {
    return this.query.connection.state.permissions.includes('clients.internal')
  }

  /**
   * @inheritdoc
   */
  get relationships () {
    return {
      user: UserView
    }
  }

  /**
   * @inheritdoc
   */
  get includes () {
    return ['user']
  }
}
