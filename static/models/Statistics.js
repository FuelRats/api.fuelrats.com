var StatisticsModel

StatisticsModel = BaseModel.extend({
  initialize: function () {
    this.set('rescuesByDate', new Backbone.Collection)
    this.set('rescuesBySystem', new Backbone.Collection)

    this.get('rescuesByDate').comparator = function (model) {
      return -model.get('date')
    }
  },

  parse: function (response) {
    response.data[0].forEach(function (item, index, array) {
      array[index].date = new Date(array[index].date)
    })
    this.get('rescuesByDate').add(response.data[0])
    this.get('rescuesBySystem').add(response.data[1])
  },

  url: '/statistics'
})
