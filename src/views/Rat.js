import SequelizeView from './Sequelize'
import RescueView from './Rescue'
import ShipView from './Ship'
import UserView from './User'

export default class RatView extends SequelizeView {
  static get type () {
    return 'rats'
  }

  get attributes () {
    const { name, data, platform, createdAt, updatedAt } = this.object
    return { name, data, platform, createdAt, updatedAt }
  }

  get relationships () {
    return {
      user: UserView,
      ships: ShipView
    }
  }

  get related () {
    return [RescueView, ShipView]
  }
}
