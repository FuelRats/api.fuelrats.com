

import { Presenter } from 'yayson'({
  adapter: 'sequelize'
})

import ObjectPresenter from 'yayson'({
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

module.exports = {
  Presenter,
  CustomPresenter,
  ObjectPresenter
}