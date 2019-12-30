/* eslint-disable */

import API, {
  authenticated,
  GET
} from '../classes/API'
import { websocket } from '../classes/WebSocket'


export default class Statistics extends API {
  get type () {
    return 'statistics'
  }

  @GET('/statistics')
  @websocket('')
  async global () {

  }

  @GET('/users/:id/statistics')
  @websocket('users', 'statistics')
  @authenticated
  async user () {

  }
}

