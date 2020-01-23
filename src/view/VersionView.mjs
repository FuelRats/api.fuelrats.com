import { ReadPermission } from './View'
import DatabaseView from './DatabaseView'

/**
 * Get JSONAPI view for an API version response
 */
export default class VersionView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'versions'
  }

  /**
   * @inheritdoc
   */
  get id () {
    return this.object.commit
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return class {
      static version
      static commit
      static branch
      static tags
      static date
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
  get relationships () {
    return {}
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
    return []
  }

  /**
   * @inheritdoc
   */
  get isGroup () {
    return false
  }

  /**
   * @inheritdoc
   */
  get isInternal () {
    return false
  }

  /**
   * @inheritdoc
   */
  get isSelf () {
    return false
  }
}
