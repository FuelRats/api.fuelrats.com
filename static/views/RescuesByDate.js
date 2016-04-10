var RescuesByDateView

RescuesByDateView = Marionette.ItemView.extend({
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
        barWidth,
        chart,
        data,
        dataContainer,
        dataHeight,
        dataWidth,
        elHeight,
        elWidth,
        height,
        margin,
        minBarWidth,
        width,
        x,
        xAxis,
        y,
        yAxis

    // Defaults
    barMargin = 1
    margin = {
      bottom: 60,
      left: 40,
      right: 20,
      top: 20
    }
    minBarWidth = 15
    minHeight = 300

    // Computed
    $svg = this.$el.find('svg')
    data = this.collection.toJSON()
    elHeight = $svg.parent().height()
    elWidth = $svg.parent().width()
    height = elHeight
    width = elWidth
    dataHeight = height - margin.bottom - margin.top
    dataWidth = width - margin.left - margin.right
    barWidth = (dataWidth / data.length) - barMargin

//    if (barWidth < minBarWidth) {
//      barWidth = minBarWidth
//      width = ((barWidth + barMargin) * data.length) + margin.left + margin.right
//      dataWidth = width - margin.left - margin.right
//    }

    if (height < minHeight) {
      height = minHeight
      dataHeight = height - margin.bottom - margin.top
    }

    chart = d3.select('#rescues-by-date')
    chart.attr('height', height)
    chart.attr('width', width)

    // Build the X axis
    x = d3.time.scale()
    x.domain([
      _.min(data, function (item) {
        return item.date
      }).date,
      _.max(data, function (item) {
        return item.date
      }).date
    ])
    x.rangeRound([0, dataWidth])
    xAxis = d3.svg.axis()
    xAxis.scale(x)
    .orient('bottom')

    // Build the Y axis
    y = d3.scale.linear()
    y.domain([0, d3.max(data, function (data) {
      return data.failure + data.success
    })])
    y.range([dataHeight, 0])
    yAxis = d3.svg.axis()
    yAxis.scale(y)
    .orient('left')
    .tickSize(-dataWidth)

    // Create main data container
    dataContainer = chart.append('g')
    .attr('width', dataWidth)
    .attr('class', 'data')
    .attr('transform', function (data, index) {
      return 'translate(' + margin.left + ',' + margin.top + ')'
    })

    // Create data groups
    bar = chart.select('.data')
    .selectAll('g')
    .data(data)
    .enter()
    .append('g')
    .attr('class', 'data-stack')
    .attr('transform', function (data, index) {
      return 'translate(' + ((index * barWidth) + (index * barMargin)) + ',0)'
    })
    .attr('data-placement', 'bottom')
    .attr('data-toggle', 'tooltip')
    .attr('title', function (data) {
      var date, failure, success

      return d3.time.format('%d %b, %Y')(data.date) + '\n' +
        data.success + ' Successful\n' +
        data.failure + ' Failed\n'
    })

    // Create failure bar
    bar
    .append('rect')
    .attr('class', 'failure-bar')
    .attr('height', function (data) {
      return dataHeight - y(data.failure)
    })
    .attr('width', barWidth)
    .attr('y', function (data, index) {
      return y(data.failure)
    })

    // Create success bar
    bar
    .append('rect')
    .attr('class', 'success-bar')
    .attr('height', function (data) {
      return dataHeight - y(data.success)
    })
    .attr('width', barWidth)
    .attr('y', function (data, index) {
      return y(data.success) - (dataHeight - y(data.failure))
    })

    // Append the X axis
    chart.append('g')
    .attr('class', 'x axis')
    .attr('transform', 'translate(' + margin.left + ',' + (dataHeight + margin.top) + ')')
    .call(xAxis)
    .selectAll('text')
    .attr('x', 9)
    .attr('y', 0)
    .attr('dy', '.35em')
    .attr('transform', 'rotate(90)')
    .style('text-anchor', 'start')

    // Append the Y axis
    chart.append('g')
    .attr('class', 'y axis')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
    .call(yAxis)
    .append('text')
    .attr('transform', 'rotate(90)')
    .attr('y', -6)
    .attr('x', 2)
    .style('text-anchor', 'start')
    .text('Rescues')

    $('[data-toggle="tooltip"]').tooltip()
  },

  tagName: 'div',

  template: Handlebars.compile(
    '<div class="card-header">' +
      'Rescues over time' +
    '</div>' +
    '<svg id="rescues-by-date"></svg>'
  )
})
