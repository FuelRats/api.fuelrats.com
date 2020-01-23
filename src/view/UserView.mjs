import { ReadPermission } from './View'
import DatabaseView from './DatabaseView'
import RatView from './RatView'
import GroupView from './GroupView'
import ClientView from './ClientView'
import NicknameView from './NicknameView'
import EpicView from './EpicView'

/**
 * Get JSONAPI view for a User
 */
export default class UserView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'users'
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return class {
      static data
      static email = ReadPermission.group
      static status
      static suspended = ReadPermission.group
      static stripeId = ReadPermission.group
      static frontierId = ReadPermission.group
      static image
      static createdAt
      static updatedAt
      static deletedAt = ReadPermission.internal
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
      rats: RatView,
      nicknames: NicknameView,
      displayRat: RatView,
      groups: GroupView,
      clients: ClientView,
      epics: EpicView
    }
  }

  /**
   * @inheritdoc
   */
  get includes () {
    return ['rats', 'displayRat', 'groups', 'clients', 'nicknames', 'epics']
  }
}
