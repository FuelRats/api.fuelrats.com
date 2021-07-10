import { NotFoundAPIError, NotImplementedAPIError } from '../classes/APIError'

import { Context } from '../classes/Context'
import { websocket } from '../classes/WebSocket'
import {
  Rescue,
  // RescueHistory,
  // RescueRatsHistory,
} from '../db'
import { GET, authenticated } from './API'
import APIResource from './APIResource'

/**
 * @classdesc Endpoint handling Rescue revisions
 * @class
 */
export default class RescueRevisions extends APIResource {
  /**
   * @inheritdoc
   */
  get type () {
    return 'rescue-revisions'
  }

  /**
   * List all revisions of a rescue
   * @param {Context} ctx Request context
   */
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

    // const rescueHistory = await RescueHistory.findAndCountAll({
    //   where: {
    //     id: ctx.params.id,
    //   },
    // })

    // const assignHistory = await RescueRatsHistory.findAndCountAll({
    //   where: {
    //     rescueId: ctx.params.id,
    //   },
    // })

    // console.log(rescueHistory, assignHistory)

    throw new NotImplementedAPIError()
  }


  /**
   * Compare two rescue revisions
   */
  @GET('/rescues/:id/revisions/:revision/compare/:revision')
  @authenticated
  rescueRevisionById () {
    throw new NotImplementedAPIError()
  }


  /**
   * @inheritdoc
   */
  changeRelationship () {
    return undefined
  }

  /**
   * @inheritdoc
   */
  isSelf () {
    return false
  }

  /**
   * @inheritdoc
   */
  get relationTypes () {
    return undefined
  }

  /**
   * @inheritdoc
   */
  get writePermissionsForFieldAccess () {
    return undefined
  }
}
