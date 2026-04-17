import DatabaseView from './DatabaseView'
import UserView from './UserView'
import { ReadPermission } from './View'

/**
 * JSONAPI view for a web push subscription
 */
export default class WebPushSubscriptionView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'web-push-subscriptions'
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return {
      endpoint: ReadPermission.self,
      expirationTime: ReadPermission.self,
      pc: ReadPermission.self,
      xb: ReadPermission.self,
      ps: ReadPermission.self,
      horizons3: ReadPermission.self,
      horizons4: ReadPermission.self,
      odyssey: ReadPermission.self,
      alertsOnly: ReadPermission.self,
      createdAt: ReadPermission.self,
      updatedAt: ReadPermission.self,
      auth: ReadPermission.internal,
      p256dh: ReadPermission.internal,
    }
  }

  /**
   * @inheritdoc
   */
  get defaultReadPermission () {
    return ReadPermission.self
  }

  /**
   * @inheritdoc
   */
  get isSelf () {
    if (this.query.connection.state.user && this.object.userId === this.query.connection.state.user.id) {
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
