import DatabaseView from './DatabaseView'
import NicknameView from './NicknameView'
import { ReadPermission } from './View'

/**
 * Get JSONAPI view for a Anniversary
 */
export default class AnniversaryView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'anniversaries'
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return class {
      static email = ReadPermission.all
      static preferredName
      static years
      static joined
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
    if (this.query.connection.state.user && this.object.id === this.query.connection.state.user.id) {
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
      nicknames: NicknameView,
    }
  }

  /**
   * @inheritdoc
   */
  get includes () {
    return ['nicknames']
  }
}
