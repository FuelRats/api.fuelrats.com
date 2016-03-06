var LeaderboardView, RatView

RatView = Marionette.ItemView.extend()

LeaderboardView = Marionette.CompositeView.extend({
  childView: RatView,

  className: 'card',

  initialize: function () {
    $(window).on('resize', this.render)
    this.listenTo(this.model, 'change', this.render)
  },

  onRender: function () {},

  tagName: 'div',

  template: Handlebars.compile(
    '<div class="card-header">' +
      'Leaderboard' +
    '</div>' +
    '<table id="leaderboard"></table>'
  )
})
