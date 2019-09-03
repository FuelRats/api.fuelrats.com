
import gitrev from 'git-rev-promises'
import packageInfo from '../../package.json'

import API, {
  Context,
  GET
} from '../classes/API'
import { websocket } from '../classes/WebSocket'
import Query from '../query'
import ObjectDocument from '../Documents/ObjectDocument'
import { DocumentViewType } from '../Documents'
import { VersionView } from '../view'

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
   * @param {Context} ctx request context
   * @returns {Promise<ObjectDocument>} document response
   */
  @GET('/version')
  @websocket('version', 'read')
  async read (ctx) {
    const [hash, branch, tags, date] = await Promise.all([
      gitrev.long(),
      gitrev.branch(),
      gitrev.tags(),
      gitrev.date()
    ])

    const result = {
      version: packageInfo.version,
      commit: hash,
      branch,
      tags,
      date
    }

    const query = new Query({ connection: ctx })
    return new ObjectDocument({ query, result, type: VersionView, view: DocumentViewType.individual })
  }

}
