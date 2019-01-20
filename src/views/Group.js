import DatabaseView from './Database'
import UserView from './User'

export default class GroupView extends DatabaseView {
  static get type () {
    return 'groups'
  }

  get attributes () {
    const {
      vhost,
      isAdministrator,
      priority,
      permissions,
      createdAt,
      updatedAt
    } = this.object
    return {
      vhost,
      isAdministrator,
      priority,
      permissions,
      createdAt,
      updatedAt
    }
  }

  get related () {
    return [UserView]
  }
}
