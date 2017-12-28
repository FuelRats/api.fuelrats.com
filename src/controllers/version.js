'use strict'
const gitrev = require('git-rev-promises')
const { ObjectPresenter } = require('../classes/Presenters')
const packageInfo = require('../../../package.json')
const APIEndpoint = require('../APIEndpoint')

class Version extends APIEndpoint {
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


module.exports = Version