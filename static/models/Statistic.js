var StatisticModel

StatisticModel = BaseModel.extend({
  initialize: function () {
    this.updateVirtuals()

    this.on('change', this.updateVirtuals)
  },

  updateVirtuals: function () {

  },

  virtuals: {

  }
})
