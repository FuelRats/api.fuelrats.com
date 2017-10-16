'use strict'
const gitrev = require('git-rev-promises')
const { ObjectPresenter } = require('../classes/Presenters')
const packageInfo = require('../../package.json')

class Version  {
  static async read () {
    const githash = await gitrev.long()
    const gitbranch = await gitrev.branch()
    const gittags = await gitrev.tags()
    const gitdate = await gitrev.date()

    return VersionPresenter.render({
      version: packageInfo.version,
      commit: githash,
      branch: gitbranch,
      tags: gittags,
      date: gitdate
    })
  }
}

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

module.exports = Version