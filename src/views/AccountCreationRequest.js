import DatabaseView from './Database'
import RatView from './Rat'
import { ReadPermission } from './index'

export default class AccountCreationRequestView extends DatabaseView {
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
