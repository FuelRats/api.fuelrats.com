import { ReadPermission, DatabaseView, UserView } from './'

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
    return class {
      static vhost
      static withoutPrefix
      static priority
      static permissions
      static channels
      static createdAt
      static updatedAt
      static deletedAt = ReadPermission.internal
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
