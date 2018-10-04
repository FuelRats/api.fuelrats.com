import SequelizeView from './Sequelize'
import UserView from './User'

export default class GroupView extends SequelizeView {
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
