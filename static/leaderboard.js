$(function () {
  var BarStackView, statistics, StatisticsView, statisticsView

  BarStackView = Marionette.ItemView.extend({
    initialize: function () {
//      console.log( 'foo' )
//      console.log( this.model )
    },

    tagName: 'g',

    template: function (model) {


      return Handlebars.compile(
        '<rect width="15" class="success-bar"></rect>'
      )
    }
  })

  StatisticsView = Marionette.CompositeView.extend({
    childView: BarStackView,

    childViewContainer: '.data',

    el: '.statistics',

    initialize: function () {
      this.collection.fetch({
        success: this.render
      })
    },

    template: Handlebars.compile(
      '<g class="header"></g>' +
      '<g class="data"></g>' +
      '<g class="footer"></g>'
    )
  })

  new StatisticsView({
    collection: new StatisticsCollection
  })
})
