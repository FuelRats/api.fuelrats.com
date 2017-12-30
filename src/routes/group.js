
import API from '../classes/API'

class Groups extends API {
  static get presenter () {
    class GroupsPresenter extends API.presenter {}
    GroupsPresenter.prototype.type = 'groups'
    return GroupsPresenter
  }
}

module.exports = Groups
