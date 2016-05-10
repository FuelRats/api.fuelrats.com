'use strict'

var RatView = Marionette.ItemView.extend({
  tagName: 'tr',

  template: Handlebars.compile(
    '<td>{{CMDRname}}</td>' +
    '<td>{{successfulRescueCount}}</td>'
  )
})

var LeaderboardView = Marionette.CompositeView.extend({
  childView: RatView,

  childViewContainer: 'tbody',

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
    '<table id="leaderboard" class="table table-hover table-striped">' +
      '<thead>' +
        '<tr>' +
          '<th>CMDR</th>' +
          '<th>Rescues</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>' +
      '</tbody>' +
    '</table>'
  )
})
