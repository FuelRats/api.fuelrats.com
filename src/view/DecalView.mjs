import { ReadPermission, DatabaseView, UserView } from '.'

/**
 * Get JSONAPI view for a Decal
 */
export default class DecalView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'decals'
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return class {
      static code
      static type
      static notes
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
    if (this.query.connection.state.user && this.object.userId === this.query.connection.state.user.id) {
      return this.query.connection.state.permissions.includes('decals.read.me')
    }
    return false
  }

  /**
   * @inheritdoc
   */
  get isGroup () {
    return this.query.connection.state.permissions.includes('decals.read')
  }

  /**
   * @inheritdoc
   */
  get isInternal () {
    return this.query.connection.state.permissions.includes('decals.internal')
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
