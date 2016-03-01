var StatisticsView

StatisticsView = Marionette.LayoutView.extend({
  el: '.statistics',

  initialize: function () {
    $(window).on('resize', this.render)
    this.listenTo(this.model, 'change', this.render)
    this.listenTo(this.model, 'sync', this.render)

    this.model.fetch()
  },

  onRender: function () {
    var barWidth,
        chart,
        data,
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

    margin = {
      bottom: 50,
      left: 40,
      right: 30,
      top: 20
    }
    data = this.model.get('rescuesByDate').toJSON()
    elHeight = this.$el.height()
    elWidth = this.$el.width()
    height = elHeight - margin.top - margin.bottom
    width = elWidth - margin.left - margin.right
    barWidth = width / data.length
    minBarWidth = 20

    if(barWidth < minBarWidth) {
      barWidth = minBarWidth
      width = (barWidth * data.length) - margin.left - margin.right
    }
    console.log(barWidth)

    chart = d3.select('.rescuesByDate')
    chart.attr('height', elHeight)
    chart.attr('width', width)

    x = d3.scale.ordinal()
    x.domain(data.map(function(data) {
      return data.date
    }))
    x.rangeBands([0, width])
    xAxis = d3.svg.axis()
    xAxis.tickFormat(d3.time.format('%x'))
    xAxis.scale(x)
    xAxis.orient('bottom')
    chart.append('g')
    .attr('class', 'x axis')
    .attr('transform', 'translate(' + margin.left + ',' + (height + margin.top) + ')')
    .call(xAxis)
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end')

    y = d3.scale.linear()
    y.domain([0, d3.max(data, function (data) {
      return data.failure + data.success
    })])
    y.range([0, height])
    yAxis = d3.svg.axis()
    yAxis.scale(y)
    yAxis.orient('left')
    chart.append('g')
    .attr('class', 'y axis')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
    .call(yAxis)
    .append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', 6)
    .attr('dy', '.71em')
    .style('text-anchor', 'end')
    .text('Rescues')

    // Create main data container
    bar = chart.append('g')
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
    .attr('transform', function (data, index) {
      return 'translate(' + (index * barWidth) + ',0)'
    })

    // Create failure bar
    bar
    .append('rect')
    .attr('class', 'failure-bar')
    .attr('height', function (data) {
      return y(data.failure)
    })
    .attr('width', barWidth)
    .attr('y', function (data, index) {
      return height - y(data.failure)
    })

    // Create success bar
    bar
    .append('rect')
    .attr('class', 'success-bar')
    .attr('height', function (data) {
      return y(data.success)
    })
    .attr('width', barWidth)
    .attr('y', function (data, index) {
      return height - y(data.success) - y(data.failure)
    })
  },

  template: Handlebars.compile(
    '<svg class="rescuesByDate"></svg>'
  )
})
