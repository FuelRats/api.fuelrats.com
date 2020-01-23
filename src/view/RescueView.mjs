import { ReadPermission } from './View'
import RatView from './RatView'
import DatabaseView from './DatabaseView'
import EpicView from './EpicView'

/**
 * Get JSONAPI view for a Rescue
 */
export default class RescueView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'rescues'
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return class {
      static client
      static clientNick
      static clientLanguage
      static commandIdentifier
      static codeRed
      static data
      static notes
      static platform
      static system
      static title
      static unidentifiedRats
      static createdAt
      static updatedAt
      static deletedAt = ReadPermission.internal
      static status
      static outcome
      static quotes
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
    const { user } = this.query.connection.state
    if (!user) {
      return false
    }

    const isAssigned = this.object.rats.some((rat) => {
      return rat.userId === user.id
    })

    let isFirstLimpet = false
    if (this.object.firstLimpet) {
      isFirstLimpet = this.object.firstLimpet.userId === user.id
    }

    if (isAssigned || isFirstLimpet) {
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
      rats: RatView,
      firstLimpet: RatView,
      epics: EpicView
    }
  }

  /**
   * @inheritdoc
   */
  get includes () {
    return ['rats', 'firstLimpet', 'epics']
  }

  /**
   * @inheritdoc
   */
  get related () {
    return [RatView]
  }
}
