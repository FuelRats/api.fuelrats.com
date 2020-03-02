import DatabaseView from './DatabaseView'
import UserView from './UserView'
import { ReadPermission } from './View'

/**
 * Get JSONAPI view for a permission group
 */
export default class GroupView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'groups'
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return {
      name: ReadPermission.group,
      vhost: ReadPermission.group,
      withoutPrefix: ReadPermission.group,
      priority: ReadPermission.group,
      permissions: ReadPermission.group,
      channels: ReadPermission.group,
      createdAt: ReadPermission.group,
      updatedAt: ReadPermission.group,
      deletedAt: ReadPermission.internal,
    }
  }

  /**
   * @inheritdoc
   */
  get defaultReadPermission () {
    return ReadPermission.group
  }

  /**
   * @inheritdoc
   */
  get isSelf () {
    return false
  }

  /**
   * @inheritdoc
   */
  get isGroup () {
    return this.query.connection.state.permissions.includes('groups.read')
  }

  /**
   * @inheritdoc
   */
  get isInternal () {
    return this.query.connection.state.permissions.includes('groups.internal')
  }

  /**
   * @inheritdoc
   */
  get related () {
    return [UserView]
  }
}
