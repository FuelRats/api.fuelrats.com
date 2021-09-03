import { websocket } from '../classes/WebSocket'
import { DocumentViewType } from '../Documents'
import ObjectDocument from '../Documents/ObjectDocument'
import buildFile from '../files/build'
import Query from '../query'
import { VersionView } from '../view'
import API, {
  GET,
} from './API'

/**
 * API endpoint to get API version information
 */
export default class Version extends API {
  /**
   * @inheritdoc
   */
  get type () {
    return 'version'
  }

  /**
   * GET /version - Gets version information
   * @endpoint
   */
  @GET('/version')
  @websocket('version', 'read')
  read (ctx) {
    const {
      hash, branch, tags, date, version,
    } = buildFile

    const result = {
      version,
      commit: hash,
      branch,
      tags,
      date,
    }

    const query = new Query({ connection: ctx })
    return new ObjectDocument({ query, result, type: VersionView, view: DocumentViewType.individual })
  }
}
