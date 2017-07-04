'use strict'

const Presenter = require('yayson')({
  adapter: 'sequelize'
}).Presenter

class UsersPresenter extends Presenter {}
UsersPresenter.prototype.type = 'users'

class RatsPresenter extends Presenter {}
RatsPresenter.prototype.type = 'rats'


class EpicsPresenter extends Presenter {}
EpicsPresenter.prototype.type = 'epics'

class RescuesPresenter extends Presenter {
  relationships () {
    return {
      rats: RatsPresenter,
      firstLimpet: RatsPresenter,
      epics: EpicsPresenter
    }
  }

  selfLinks (instance) {
    return `/rescues/${this.id(instance)}`
  }

  links (instance) {
    return {
      rescues: {
        self: this.selfLinks(instance),
        related: this.selfLinks(instance)
      }
    }
  }
}
RescuesPresenter.prototype.type = 'rescues'

class ClientsPresenter extends Presenter {
  relationships () {
    return {
      user: UsersPresenter
    }
  }
}
ClientsPresenter.prototype.type = 'clients'

module.exports = {
  Presenter,
  UsersPresenter,
  RatsPresenter,
  RescuesPresenter,
  EpicsPresenter,
  ClientsPresenter
}