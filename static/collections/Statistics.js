var StatisticsCollection

StatisticsCollection = BaseCollection.extend({
  model: StatisticModel,

  parse: function (response) {
    return response.data
  },

  url: '/statistics'
})
