$(function () {
  var StatisticsView

  StatisticsView = Marionette.LayoutView.extend({
    el: '#leaderboard',

    initialize: function () {
      this.listenTo(this.model, 'sync', this.render)
      this.model.fetch({
        success: function (model, response, xhr) {
          console.log(response.data[2][0])
        }
      })
    },

    onRender: function () {
      this.getRegion('rescuesByDate').show(new RescuesByDateView({
        collection: this.model.get('rescuesByDate')
      }))
      this.getRegion('rescuesBySystem').show(new RescuesBySystemView({
        collection: this.model.get('rescuesBySystem')
      }))
      this.getRegion('leaderboard').show(new LeaderboardView({
        collection: this.model.get('leaderboard')
      }))
    },

    regions: {
      leaderboard: '#leaderboard-container',
      rescuesByDate: '#rescues-by-date-container',
      rescuesBySystem: '#rescues-by-system-container'
    },

    template: Handlebars.compile(
      '<div class="container-fluid">' +
        '<div class="row">' +
          '<div id="leaderboard-container" class="col-md-4">' +
          '</div>' +
          '<div class="col-md-8">' +
            '<div class="row">' +
              '<div id="rescues-by-date-container" class="col-md-12"></div>' +
            '</div>' +
            '<div class="row">' +
              '<div id="rescues-by-system-container" class="col-md-12"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
//      '<div class="container-fluid">' +
//        '<div class="row">' +
//          '<div id="rescues-by-date-container" class="col-md-6"></div>' +
//          '<div id="rescues-by-system-container" class="col-md-6"></div>' +
//        '</div>' +
//        '<div class="row">' +
//          '<div id="leaderboard-container" class="col-md-12"></div>' +
//        '</div>' +
//      '</div>'
    )
  })

  new StatisticsView({
    model: new StatisticsModel
  })
})
