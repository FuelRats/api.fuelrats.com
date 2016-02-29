var StatisticsModel

StatisticsModel = BaseModel.extend({
  initialize: function () {
    this.set('rescuesByDate', new Backbone.Collection)
    this.set('rescuesBySystem', new Backbone.Collection)
  },

  parse: function (response) {
    this.get('rescuesByDate').add(response.data[0])
    this.get('rescuesBySystem').add(response.data[1])
  },

  url: '/statistics'
})
