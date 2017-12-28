
import APIEndpoint from '../APIEndpoint'

class Epics extends APIEndpoint {
  static get presenter () {
    class EpicsPresenter extends APIEndpoint.presenter {}
    EpicsPresenter.prototype.type = 'epics'
    return EpicsPresenter
  }
}

module.exports =  Epics
