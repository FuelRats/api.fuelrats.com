
import API from '../classes/API'

class Epics extends API {
  static get presenter () {
    class EpicsPresenter extends API.presenter {}
    EpicsPresenter.prototype.type = 'epics'
    return EpicsPresenter
  }
}

module.exports =  Epics
