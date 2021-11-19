import config from '../config'
import AvatarView from './AvatarView'
import ClientView from './ClientView'
import DatabaseView from './DatabaseView'
import DecalView from './DecalView'
import EpicView from './EpicView'
import GroupView from './GroupView'
import NicknameView from './NicknameView'
import RatView from './RatView'
import { ReadPermission } from './View'
import AuthenticatorView from './AuthenticatorView.mjs'

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
      avatar: AvatarView,
      rats: RatView,
      nicknames: NicknameView,
      displayRat: RatView,
      groups: GroupView,
      clients: ClientView,
      epics: EpicView,
      decals: DecalView,
      authenticator: AuthenticatorView,
    }
  }

  /**
   * @inheritdoc
   */
  getRelationLink (relation) {
    switch (relation) {
      case 'avatar':
        return {
          self: `${config.server.externalUrl}/${this.self}/image`,
        }

      default:
        return super.getRelationLink(relation)
    }
  }

  /**
   * @inheritdoc
   */
  get meta () {
    const meta = {}
    if (Reflect.has(this.object, 'redeemable')) {
      meta.redeemable = this.object.redeemable
    }

    if (Reflect.has(this.object, 'permissions')) {
      meta.permissions = this.object.permissions
    }
    return meta
  }

  /**
   * @inheritdoc
   */
  get includes () {
    return [
      'avatar',
      'rats',
      'displayRat',
      'groups',
      'clients',
      'nicknames',
      'epics',
      'decals',
      'authenticator',
    ]
  }
}
