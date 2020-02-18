import { NotFoundAPIError } from '../classes/APIError'
import { websocket } from '../classes/WebSocket'
import { Rescue, RescueHistory, RescueRatsHistory } from '../db'
import { GET, authenticated } from './API'
import APIResource from './APIResource'

export default class RescueRevisions extends APIResource {
  get type () {
    return 'rescue-revisions'
  }

  @GET('/rescues/:id/revisions')
  @websocket('rescues', 'revisions', 'search')
  @authenticated
  async rescueRevisionSearch (ctx) {
    const rescue = await Rescue.findOne({
      where: { id: ctx.params.id },
    })

    if (!rescue) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    const rescueHistory = await RescueHistory.findAndCountAll({
      where: {
        id: ctx.params.id,
      },
    })

    const assignHistory = await RescueRatsHistory.findAndCountAll({
      where: {
        rescueId: ctx.params.id,
      },
    })

    console.log(rescueHistory, assignHistory)
  }

  @GET('/rescues/:id/revisions/:revision/compare/:revision')
  @authenticated
  async rescueRevisionById (ctx) {

  }


  changeRelationship ({ relationship }) {
    return undefined
  }

  isSelf ({ ctx, entity }) {
    return false
  }

  get relationTypes () {
    return undefined
  }

  get writePermissionsForFieldAccess () {
    return undefined
  }
}
