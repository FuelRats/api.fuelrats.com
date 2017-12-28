
import APIEndpoint from '../APIEndpoint'

class Groups extends APIEndpoint {
  static get presenter () {
    class GroupsPresenter extends APIEndpoint.presenter {}
    GroupsPresenter.prototype.type = 'groups'
    return GroupsPresenter
  }
}

module.exports = Groups
