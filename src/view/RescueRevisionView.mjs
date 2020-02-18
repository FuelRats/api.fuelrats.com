import DatabaseView from './DatabaseView'
import RescueView from './RescueView'
import UserView from './UserView'
import { ReadPermission } from './View'

/**
 * Get JSONAPI view for a rescue revision
 */
export default class RescueRevisionView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'rescue-revisions'
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return class {
      static document
      static operation
      static revision
      static createdAt
      static updatedAt
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
      return this.query.connection.state.permissions.includes('rescues.read.me')
    }
    return false
  }

  /**
   * @inheritdoc
   */
  get isGroup () {
    return this.query.connection.state.permissions.includes('rescues.read')
  }

  /**
   * @inheritdoc
   */
  get isInternal () {
    return this.query.connection.state.permissions.includes('rescues.internal')
  }

  /**
   * @inheritdoc
   */
  get relationships () {
    return {
      rescue: RescueView,
      user: UserView,
    }
  }

  /**
   * @inheritdoc
   */
  get related () {
    return [RescueView, UserView]
  }

  /**
   * @inheritdoc
   */
  get includes () {
    return [RescueView, UserView]
  }
}
