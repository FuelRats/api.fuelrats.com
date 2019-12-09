import DatabaseView from './DatabaseView'
import { ReadPermission } from './View'


export default class RescueClientView extends DatabaseView {
  static get type () {
    return 'rescue-clients'
  }

  get attributes () {
    return class {
      static name
      static nickname
      static language
      static createdAt
      static updatedAt
    }
  }

  get defaultReadPermission () {
    return ReadPermission.group
  }
}
