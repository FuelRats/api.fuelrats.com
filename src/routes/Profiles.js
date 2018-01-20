
import { User } from '../db'
import Rats from './Rats'
import Groups from './Groups'
import NPO from './NPO'

import API, {
  authenticated,
  GET
} from '../classes/API'
import { websocket } from '../classes/WebSocket'

export default class Profiles extends API {
  @GET('/profile')
  @websocket('profiles', 'read')
  @authenticated
  async read  (ctx) {
    let profile = await User.scope('defaultScope', 'profile').findOne({
      where: {
        id: ctx.state.user.id
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
          displayRat: Rats.presenter,
          npoMembership: NPO.presenter
        }
      }
    }
    ProfilesPresenter.prototype.type = 'profiles'
    return ProfilesPresenter
  }
}
