import DatabaseView from './Database'
import UserView from './User'

export default class ClientView extends DatabaseView {
  static get type () {
    return 'clients'
  }

  get attributes () {
    const {
      name,
      redirectUri,
      createdAt,
      updatedAt
    } = this.object

    return {
      name,
      redirectUri,
      createdAt,
      updatedAt
    }
  }

  get relationships () {
    return {
      user: UserView
    }
  }

  get includes () {
    return []
  }
}
