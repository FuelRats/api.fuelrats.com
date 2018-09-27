import SequelizeView from './Sequelize'
import RatView from './Rat'
import GroupView from './Group'

export default class UserView extends SequelizeView {
  get type () {
    return 'users'
  }

  get attributes () {
    const {
      data,
      email,
      nicknames,
      status,
      createdAt,
      updatedAt
    } = this.object

    return {
      data,
      email,
      nicknames,
      status,
      createdAt,
      updatedAt
    }
  }

  get relationships () {
    return {
      displayRat: RatView,
      groups: GroupView,
    }
  }

  get includes () {
    return {
      displayRat: RatView,
      groups: GroupView
    }
  }
}
