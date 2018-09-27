import SequelizeView from './Sequelize'
import UserView from './Sequelize'

export default class GroupView extends SequelizeView {
  get type () {
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
