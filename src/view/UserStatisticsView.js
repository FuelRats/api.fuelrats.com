import { ReadPermission, DatabaseView, RatView } from './'

/**
 * Get JSONAPI view for a user statistics result
 */
export default class UserStatisticsView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'user-statistics'
  }

  /**
   * @inheritdoc
   */
  get id () {
    return this.object.id
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return {
      name: ReadPermission.all,
      codeRed: ReadPermission.all,
      firstLimpet: ReadPermission.all,
      assists: ReadPermission.all,
      failure: ReadPermission.all,
      other: ReadPermission.all,
      invalid: ReadPermission.all
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
    return {}
  }

  /**
   * @inheritdoc
   */
  get related () {
    return [RatView]
  }

  /**
   * @inheritdoc
   */
  get includes () {
    return []
  }
}
