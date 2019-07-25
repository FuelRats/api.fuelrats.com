import { ReadPermission, DatabaseView } from './'

export default class ACRView extends DatabaseView {
  static get type () {
    return 'account-creation-request'
  }

  get attributes () {
    return class {
      static name
      static token
      static platform
      static createdAt
      static updatedAt
    }
  }

  get defaultReadPermission () {
    return ReadPermission.all
  }


  get relationships () {
    return {

    }
  }

  get related () {
    return []
  }
}
