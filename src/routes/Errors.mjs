import * as errors from '../classes/APIError'
import { websocket } from '../classes/WebSocket'
import API, { GET } from './API'

/**
 * Endpoints for requesting any API error to be thrown, for usage by clients for testing.
 */
export default class Errors extends API {
  /**
   * Endpoint for requesting a specific API error be thrown by name
   * @endpoint
   */
  @GET('/errors/:code')
  @websocket('errors', 'read')
  read (ctx) {
    const { code } = ctx.params

    const RequestedError = Object.values(errors).find((APIError) => {
      return (new APIError({})).status === code
    })

    if (!RequestedError) {
      throw new errors.NotFoundAPIError({ parameter: 'code' })
    }

    throw new RequestedError({
      parameter: 'test',
      pointer: '/data/attributes/test',
    })
  }

  /**
   * @inheritdoc
   */
  get type () {
    return 'errors'
  }
}

