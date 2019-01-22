import DatabaseView from './Database'
import RatView from './Rat'
import GroupView from './Group'
import ClientView from './Client'

export default class UserView extends DatabaseView {
  static get type () {
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
      rats: RatView,
      displayRat: RatView,
      groups: GroupView,
      clients: ClientView
    }
  }

  get includes () {
    return ['rats', 'displayRat', 'groups', 'clients']
  }
}
