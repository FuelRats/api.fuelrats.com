'use strict'
const APIEndpoint = require('../APIEndpoint')

class Groups extends APIEndpoint {
  static get presenter () {
    class GroupsPresenter extends APIEndpoint.presenter {}
    GroupsPresenter.prototype.type = 'groups'
    return GroupsPresenter
  }
}

module.exports = Groups
