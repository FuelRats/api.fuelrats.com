import packageInfo from '../../package.json'

import API, {
  GET
} from './API'
import { websocket } from '../classes/WebSocket'
import Query from '../query'
import ObjectDocument from '../Documents/ObjectDocument'
import { DocumentViewType } from '../Documents'
import { VersionView } from '../view'
import fs from 'fs'

let version = undefined
fs.readFile('build.json', (err, data) => {
  if (err) {
    throw err
  }
  version = JSON.parse(data)
})

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
    const { hash, branch, tags, date } = version

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
