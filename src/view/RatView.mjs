import DatabaseView from './DatabaseView'
import RescueView from './RescueView'
import UserView from './UserView'
import { ReadPermission } from './View'

/**
 * Get JSONAPI view for a rat
 */
export default class RatView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'rats'
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return {
      name: ReadPermission.all,
      data: ReadPermission.all,
      platform: ReadPermission.all,
      expansion: ReadPermission.all,
      frontierId: ReadPermission.group,
      createdAt: ReadPermission.all,
      updatedAt: ReadPermission.all,
      deletedAt: ReadPermission.internal,
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
      return this.query.connection.state.permissions.includes('rats.read.me')
    }
    return false
  }

  /**
   * @inheritdoc
   */
  get isGroup () {
    return this.query.connection.state.permissions.includes('rats.read')
  }

  /**
   * @inheritdoc
   */
  get isInternal () {
    return this.query.connection.state.permissions.includes('rats.internal')
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
  get related () {
    return [RescueView]
  }

  /**
   * @inheritdoc
   */
  get includes () {
    return ['user']
  }
}
