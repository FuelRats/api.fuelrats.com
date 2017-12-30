
import { User } from '../db'
import Rats from './rat'
import Groups from './group'

import APIEndpoint, {
  authenticated,
  GET
} from '../APIEndpoint'

export default class Profiles extends APIEndpoint {
  @GET('/profile')
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
    class ProfilesPresenter extends APIEndpoint.presenter {
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