'use strict'

const Presenter = require('yayson')({
  adapter: 'sequelize'
}).Presenter

const ObjectPresenter = require('yayson')({
  adapter: 'default'
}).Presenter

class CustomPresenter extends ObjectPresenter {
  id (instance) {
    return instance.id || null
  }

  attributes (instance) {
    return instance
  }
}
CustomPresenter.prototype.type = 'custom'

class SubscriptionsPresenter extends ObjectPresenter {
  id (instance) {
    return instance.id
  }

  attributes (instance) {
    if (instance) {
      return ['id']
    }
    return null
  }
}
SubscriptionsPresenter.prototype.type = 'subscriptions'

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
  ClientsPresenter,
  SubscriptionsPresenter,
  CustomPresenter
}