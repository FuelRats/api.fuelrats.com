import { ReadPermission } from './View'
import DatabaseView from './DatabaseView'
import UserView from './UserView'
import RescueView from './RescueView'

/**
 * Get JSONAPI view for an Epic nomination
 */
export default class EpicView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'epics'
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return {
      notes: ReadPermission.sudo,
      createdAt: ReadPermission.all,
      updatedAt: ReadPermission.all,
      deletedAt: ReadPermission.internal
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
    if (this.query.connection.state.user) {
      if (this.object.nominatedById === this.query.connection.state.user.id) {
        return this.query.connection.state.permissions.includes('epics.read.me')
      }
    }
    return false
  }

  /**
   * @inheritdoc
   */
  get isGroup () {
    return this.query.connection.state.permissions.includes('epics.read')
  }

  /**
   * @inheritdoc
   */
  get isInternal () {
    return this.query.connection.state.permissions.includes('epics.internal')
  }

  /**
   * @inheritdoc
   */
  get relationships () {
    return {
      nominees: UserView,
      rescue: RescueView,
      nominatedBy: UserView,
      approvedBy: UserView
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
    return ['nominees', 'nominatedBy', 'approvedBy']
  }
}
