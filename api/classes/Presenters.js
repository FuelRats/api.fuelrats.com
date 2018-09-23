'use strict'

const { Presenter } = require('yayson')({
  adapter: 'sequelize'
})

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

class ProductsPresenter extends ObjectPresenter {
  id (instance) {
    return instance.id
  }

  attributes (instance) {
    if (instance) {
      return {
        active: instance.active,
        attributes: instance.attributes,
        caption: instance.caption,
        createdAt: new Date(instance.created * 1000),
        description: instance.description,
        images: instance.images,
        livemode: instance.livemode,
        metadata: instance.metadata,
        name: instance.name,
        dimensions: instance.package_dimensions,
        shippable: true,
        skus: instance.skus,
        productType: instance.type,
        url: instance.url,
        updatedAt: new Date(instance.updated * 1000)
      }
    }
    return null
  }
}
ProductsPresenter.prototype.type = 'products'

class OrdersPresenter extends ObjectPresenter {
  id (instance) {
    return instance.id
  }

  attributes (instance) {
    if (instance) {
      return {
        amount: instance.amount,
        returned: instance.amount_returned,
        application: instance.application,
        applicationFee: instance.application_fee,
        charge: instance.charge,
        currency: instance.currency,
        email: instance.email,
        livemode: instance.livemode,
        metadata: instance.metadata,
        shippingMethod: instance.selected_shipping_method,
        shipping: instance.shipping,
        shippingMethods: instance.shipping_methods,
        status: instance.status,
        statusTransitions: instance.status_transitions,
        items: instance.items,
        returns: instance.returns,
        createdAt: new Date(instance.created * 1000),
        updatedAt: new Date(instance.updated * 1000)
      }
    }
    return null
  }
}
OrdersPresenter.prototype.type = 'order'

class CustomersPresenter extends ObjectPresenter {
  id (instance) {
    return instance.id
  }

  attributes (instance) {
    if (instance) {
      instance.createdAt = new Date(instance.created * 1000)
      delete instance.created
      return instance
    }
    return null
  }
}
CustomersPresenter.prototype.type = 'products'

class DecalsPresenter extends Presenter {}
DecalsPresenter.prototype.type = 'decals'

class ShipsPresenter extends Presenter {}
ShipsPresenter.prototype.type = 'ships'

class UsersPresenter extends Presenter {
  relationships () {
    return {
      rats: RatsPresenter,
      groups: GroupsPresenter,
      displayRat: RatsPresenter
    }
  }
}
UsersPresenter.prototype.type = 'users'

class ProfilesPresenter extends Presenter {
  relationships () {
    return {
      rats: RatsPresenter,
      groups: GroupsPresenter,
      displayRat: RatsPresenter
    }
  }
}
ProfilesPresenter.prototype.type = 'profiles'

class RatsPresenter extends Presenter {
  relationships () {
    return {
      ships: ShipsPresenter
    }
  }
}
RatsPresenter.prototype.type = 'rats'


class EpicsPresenter extends Presenter {}
EpicsPresenter.prototype.type = 'epics'

class GroupsPresenter extends Presenter {}
GroupsPresenter.prototype.type = 'groups'

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

class NicknamesPresenter extends CustomPresenter {
  id (instance) {
    return instance.nickname
  }
}
NicknamesPresenter.prototype.type = 'nicknames'


class RescueStatisticsPresenter extends CustomPresenter {
  id (instance) {
    return instance.date || null
  }
}
RescueStatisticsPresenter.prototype.type = 'rescuestatistics'

class SystemStatisticsPresenter extends CustomPresenter {
  id (instance) {
    return instance.system || null
  }
}
SystemStatisticsPresenter.prototype.type = 'systemstatistics'

class RatStatisticsPresenter extends CustomPresenter {
  id (instance) {
    return instance.id || null
  }
}
RatStatisticsPresenter.prototype.type = 'ratstatistics'

module.exports = {
  Presenter,
  UsersPresenter,
  RatsPresenter,
  RescuesPresenter,
  EpicsPresenter,
  ClientsPresenter,
  DecalsPresenter,
  SubscriptionsPresenter,
  CustomPresenter,
  NicknamesPresenter,
  GroupsPresenter,
  ShipsPresenter,
  ProfilesPresenter,
  RescueStatisticsPresenter,
  SystemStatisticsPresenter,
  RatStatisticsPresenter,
  ProductsPresenter,
  OrdersPresenter,
  CustomersPresenter,
  ObjectPresenter
}
