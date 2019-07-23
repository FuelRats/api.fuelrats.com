
import { User } from '../db'
import Rats from './Rats'
import Groups from './Groups'
import NPO from './NPO'
import Client from './Clients'

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
    const profile = await User.scope('profile').findOne({
      where: {
        id: ctx.state.user.id
      }
    })
    return Profiles.presenter.render(profile)
  }
}
