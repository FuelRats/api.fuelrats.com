import yayson from 'yayson'

let { Presenter } = yayson({
  adapter: 'sequelize'
})

let ObjectPresenter = yayson({
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