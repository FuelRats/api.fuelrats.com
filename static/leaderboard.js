$(function () {
  var StatisticsView, statisticsView

  StatisticsView = Marionette.LayoutView.extend({
    el: '.statistics',

    initialize: function () {
      $(window).on('resize', this.render)
      this.listenTo(this.model, 'change', this.render)
      this.listenTo(this.model, 'sync', this.render)

      this.model.fetch()
    },

    onRender: function () {
      var chart, data, width, x, y

      data= this.model.get('rescuesByDate').toJSON()
      height = this.$el.height()
      barWidth = this.$el.width() / data.length
      y = d3.scale.linear()
      y.domain([0, d3.max(data, function (data) {
        return data.failure + data.success
      })])
      y.range([0, height])

      chart = d3.select('.rescuesByDate')

      bar = chart.selectAll('g')
      .data(data)
      .enter()
      .append('g')
      .attr('transform', function (data, index) {
        return 'translate(' + (index * barWidth) + ',0)'
      })

      bar
      .append('rect')
      .attr('class', 'success-bar')
      .attr('height', function (data) {
        return y(data.success)
      })
      .attr('width', barWidth)
      .attr('y', function (data, index) {
        return height - y(data.success)
      })

//      .selectAll('rect')
//      .data(data)
//      .enter()
//      .append('rect')
//      .attr('class', 'success-bar')
//      .attr('transform', function (data, index) {
//        return 'translate(' + (index * barWidth) + ',' + (height - y(data.success)) + ')'
//      })
//      .style('width', barWidth)
//      .style('height', function (data) {
//        return y(data.success) + 'px'
//      })
    },

    template: Handlebars.compile(
      '<svg class="rescuesByDate"></svg>' +
      '<svg class="rescuesBySystem"></svg>'
    )
  })

  statisticsView = new StatisticsView({
    model: new StatisticsModel
  })
})
