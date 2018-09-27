
import gitrev from 'git-rev-promises'
import { ObjectPresenter } from '../classes/Presenters'
import packageInfo from '../../package.json'
import API, {
  GET
} from '../classes/API'
import { websocket } from '../classes/WebSocket'

export default class Version extends API {
  @GET('/version')
  @websocket('version', 'read')
  async read () {
    const [hash, branch, tags, date] = await Promise.all([
      gitrev.long(),
      gitrev.branch(),
      gitrev.tags(),
      gitrev.date()
    ])

    return Version.presenter.render({
      version: packageInfo.version,
      commit: hash,
      branch: branch,
      tags: tags,
      date: date
    })
  }

  static get presenter () {
    class VersionPresenter extends ObjectPresenter {
      id (instance) {
        return instance.commit
      }

      attributes (instance) {
        if (instance) {
          return instance
        }
        return null
      }
    }

    return VersionPresenter
  }
}
