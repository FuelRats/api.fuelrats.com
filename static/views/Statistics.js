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
        dataContainer,
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

    margin = {
      bottom: 60,
      left: 40,
      right: 30,
      top: 20
    }
    data = this.model.get('rescuesByDate').toJSON()
    elHeight = this.$el.height()
    elWidth = this.$el.width()
    height = elHeight - margin.top - margin.bottom
    width = elWidth
    dataWidth = width - margin.left - margin.right
    barWidth = dataWidth / data.length
    minBarWidth = 15

    if (barWidth < minBarWidth) {
      barWidth = minBarWidth
      width = (barWidth * data.length) + margin.left + margin.right
      dataWidth = width - margin.left - margin.right
    }

    chart = d3.select('.rescuesByDate')
    chart.attr('height', elHeight)
    chart.attr('width', width)

    x = d3.time.scale()
    x.domain([
      _.max(data, function (item) {
        return item.date
      }).date,
      _.min(data, function (item) {
        return item.date
      }).date
    ])
    x.range([0, width - margin.right])
    xAxis = d3.svg.axis()
    xAxis.scale(x)
    xAxis.orient('bottom')
    chart.append('g')
    .attr('class', 'x axis')
    .attr('transform', 'translate(0,' + (height + margin.top) + ')')
    .call(xAxis)
    .selectAll('text')
    .attr('x', 9)
    .attr('y', 0)
    .attr('dy', '.35em')
    .attr('transform', 'rotate(90)')
    .style('text-anchor', 'start')

    y = d3.scale.linear()
    y.domain([0, d3.max(data, function (data) {
      return data.failure + data.success
    })])
    y.range([height, 0])
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
    .attr('transform', function (data, index) {
      return 'translate(' + (index * barWidth) + ',0)'
    })
    .attr('data-placement', 'bottom')
    .attr('data-toggle', 'tooltip')
    .attr('title', function (data) {
      var date, failure, success

      date = d3.time.format('%d %b, %Y')(data.date) + '\n'
      failure = data.failure + ' Failed\n'
      success = data.success + ' Successful\n'

      return date + success + failure
    })

    // Create failure bar
    bar
    .append('rect')
    .attr('class', 'failure-bar')
    .attr('height', function (data) {
      return height - y(data.failure)
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
      return height - y(data.success)
    })
    .attr('width', barWidth)
    .attr('y', function (data, index) {
      return y(data.success) - (height - y(data.failure))
    })

    $('[data-toggle="tooltip"]').tooltip()
  },

  template: Handlebars.compile(
    '<svg class="rescuesByDate"></svg>'
  )
})
