
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
    const githash = await gitrev.long()
    const gitbranch = await gitrev.branch()
    const gittags = await gitrev.tags()
    const gitdate = await gitrev.date()

    return Version.presenter.render({
      version: packageInfo.version,
      commit: githash,
      branch: gitbranch,
      tags: gittags,
      date: gitdate
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
