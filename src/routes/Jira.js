import API, { GET, authenticated } from '../classes/API'
import { User } from '../db'

/**
 * Jira SSO endpoints
 */
export default class Jira extends API {
  /**
   * @inheritdoc
   */
  get type () {
    return 'jira'
  }

  /**
   * User profile information for Jira SSO
   * @endpoint
   */
  @GET('/jira/profile')
  @authenticated
  async profile (ctx) {
    const user = await User.findOne({
      where: {
        id: ctx.state.user.id
      }
    })

    const userGroups = user.groups.map((group) => {
      return group.id
    })

    return {
      id: user.id,
      email: user.email,
      emailVerified: userGroups.includes('verified'),
      username: user.preferredRat().name,
      profile: 'https://fuelrats.com/profile/overview',
      name: user.preferredRat().name,
      groups: userGroups
    }
  }
}
