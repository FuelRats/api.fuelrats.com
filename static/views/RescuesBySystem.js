var RescuesBySystemView

RescuesBySystemView = Marionette.ItemView.extend({
  className: 'card',

  initialize: function (options) {
    $(window).on('resize', this.render)
  },

  onAttach: function () {
    this.renderChart()
  },

  onRender: function () {
    this.renderChart()
  },

  renderChart: function () {
    var $svg,
        bubble,
        chart,
        color,
        data,
        diameter,
        height,
        node,
        width

    // Computed
    $svg = this.$el.find('svg')
    color = d3.scale.category20c()
    height = $svg.parent().height()
    width = $svg.parent().width()
    data = this.collection.toJSON()
    diameter = height > width ? height : width

    bubble = d3.layout.pack()
    bubble
    .padding(1.5)
    .size([diameter, diameter])
    .sort(null)
    .value(function (data) {
      return data.count
    })

    chart = d3.select('#rescues-by-system')
    chart.attr('height', diameter)
    chart.attr('width', diameter)

    node = chart.selectAll('.node')
    .data(
      bubble
      .nodes({children: data})
      .filter(function (data) {
        return !data.children
      })
    )
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', function (data) {
      return 'translate(' + data.x + ',' + data.y + ')'
    })

    node.append('title')
    .text(function (data) {
      return data.name + ': ' + data.value
    })

    node.append('circle')
    .attr('r', function (data) {
      return data.r
    })
    .attr('fill', function (data) {
      return color(data.name)
    })

    node.append('text')
    .attr('dy', '.3em')
    .style('text-anchor', 'middle')
    .text(function (data) {
      return data.name.substring(0, data.r / 3)
    })

    $('[data-toggle="tooltip"]').tooltip()
  },

  tagName: 'div',

  template: Handlebars.compile(
    '<div class="card-header">' +
      'Rescues by system' +
    '</div>' +
    '<div class="card-block">' +
      '<svg id="rescues-by-system"></svg>' +
    '</div>'
  )
})
