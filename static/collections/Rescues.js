var RescuesCollection

RescuesCollection = BaseCollection.extend({
  model: RescueModel,

  parse: function (response) {
    return response.data
  },

  url: '/rescues'
})
