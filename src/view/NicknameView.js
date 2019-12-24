import { ReadPermission, DatabaseView, UserView, RatView } from './'

/**
 * Get JSONAPI view for an IRC nickname
 */
export default class NicknameView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'nicknames'
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
      static lastQuit
      static lastRealHost = ReadPermission.group
      static lastRealName
      static lastSeen
      static lastUserMask
      static display
      static nick
      static createdAt
      static updatedAt
      static vhost
      static vhostSetBy = ReadPermission.internal
      static vhostSetAt = ReadPermission.internal
      static email = ReadPermission.group
      static password = ReadPermission.internal
      static fingerprint = ReadPermission.internal
      static score
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
    if (this.object.user?.id !== this.query.connection.state.user?.id) {
      return false
    }
    return this.query.connection.state.permissions.includes('nicknames.read.me')
  }

  /**
   * @inheritdoc
   */
  get isGroup () {
    return this.query.connection.state.permissions.includes('nicknames.read')
  }

  /**
   * @inheritdoc
   */
  get isInternal () {
    return this.query.connection.state.permissions.includes('nicknames.internal')
  }

  /**
   * @inheritdoc
   */
  get relationships () {
    return {
      user: UserView,
      rat: RatView
    }
  }

  /**
   * @inheritdoc
   */
  get related () {
    return []
  }

  /**
   * @inheritdoc
   */
  get includes () {
    return ['user']
  }
}
