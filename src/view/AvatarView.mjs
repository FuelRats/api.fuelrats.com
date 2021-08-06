import config from '../config'
import DatabaseView from './DatabaseView'
import UserView from './UserView'
import { ReadPermission } from './View'

/**
 * Get JSONAPI view for a User
 */
export default class AvatarView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'avatars'
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return class {
      static createdAt
      static updatedAt
    }
  }

  /**
   * @inheritdoc
   */
  get links () {
    return {
      self: `${config.server.externalUrl}/users/${this.object.userId}/image`,
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
