import { ReadPermission } from './View'
import DatabaseView from './DatabaseView'
import RatView from './RatView'

/**
 * Get JSONAPI view for a Ship
 */
export default class ShipView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'ships'
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return {
      name: ReadPermission.all,
      shipId: ReadPermission.all,
      shipType: ReadPermission.all,
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
      const ratExists = this.query.connection.state.user.rats.some((rat) => {
        return rat.id === this.object.ratId
      })
      if (ratExists) {
        return this.query.connection.state.permissions.includes('ships.read.me')
      }
    }
    return false
  }

  /**
   * @inheritdoc
   */
  get isGroup () {
    return this.query.connection.state.permissions.includes('ships.read')
  }

  /**
   * @inheritdoc
   */
  get isInternal () {
    return this.query.connection.state.permissions.includes('ships.internal')
  }

  /**
   * @inheritdoc
   */
  get relationships () {
    return {
      rat: RatView
    }
  }

  /**
   * @inheritdoc
   */
  get related () {
    return [RatView]
  }
}
