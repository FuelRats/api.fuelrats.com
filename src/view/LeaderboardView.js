import { ReadPermission, DatabaseView, UserView } from './'

/**
 * Get JSONAPI view for a leaderboard entry
 */
export default class LeaderboardView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'leaderboard-entries'
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
    return class {
      static preferredName
      static ratNames
      static joinedAt
      static rescueCount
      static codeRedCount
      static isDispatch
      static isEpic
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
    return true
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
    return [UserView]
  }

  /**
   * @inheritdoc
   */
  get includes () {
    return []
  }
}
