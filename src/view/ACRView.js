import { ReadPermission, DatabaseView } from './'

/**
 * JSONAPI view for account creation requests
 */
export default class ACRView extends DatabaseView {
  /**
   * @inheritdoc
   */
  static get type () {
    return 'account-creation-request'
  }

  /**
   * @inheritdoc
   */
  get attributes () {
    return class {
      static name
      static token
      static platform
      static createdAt
      static updatedAt
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
   * @returns {{}}
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
}
