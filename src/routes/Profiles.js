
import { User } from '../db'
import Rats from './Rats'
import Groups from './Groups'

import API, {
  authenticated,
  GET,
  websocket
} from '../classes/API'

export default class Profiles extends API {
  @GET('/profile')
  @websocket('profiles', 'read')
  @authenticated
  async read  (ctx) {
    let profile = await User.scope('defaultScope', 'profile').findOne({
      where: {
        id: ctx.state.user.data.id
      }
    })
    return Profiles.presenter.render(profile)
  }

  static get presenter () {
    class ProfilesPresenter extends API.presenter {
      relationships () {
        return {
          rats: Rats.presenter,
          groups: Groups.presenter,
          displayRat: Rats.presenter
        }
      }
    }
    ProfilesPresenter.prototype.type = 'profiles'
    return ProfilesPresenter
  }
}