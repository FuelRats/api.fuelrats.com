'use strict'
/* global _, d3 */

class Leaderboard {
  constructor () {
    let request = new XMLHttpRequest()
    request.open('GET', '/statistics', true)
    request.setRequestHeader('Content-Type', 'application/json;charset=UTF-8')
    request.onload = () => {
      let response = JSON.parse(request.responseText)

      this.rescueDateData = response.data[1].map(function (rescueDay) {
        rescueDay.date = new Date(rescueDay.date)
        return rescueDay
      })
      this.rescueSystemData = response.data[0]

      this.renderRescuesView()
      this.renderSystemView()
      jQuery(window).on('resize', this.renderRescuesView.bind(this))
      jQuery(window).on('resize', this.renderSystemView.bind(this))
    }
    request.send()
  }

  renderRescuesView () {
    // Defaults
    let barMargin = 1
    let margin = {
      bottom: 60,
      left: 40,
      right: 20,
      top: 20
    }

    let minHeight = 400

    // Computed
    let $svg = $('#rescues-by-date')
    $svg.empty()

    let data = this.rescueDateData
    let elHeight = $svg.parent().height()
    let elWidth = $svg.parent().width()
    let height = elHeight
    let width = elWidth
    let dataHeight = height - margin.bottom - margin.top
    let dataWidth = width - margin.left - margin.right
    let barWidth = (dataWidth / data.length) - barMargin

    if (height < minHeight) {
      height = minHeight
      dataHeight = height - margin.bottom - margin.top
    }

    let chart = d3.select('#rescues-by-date')
    chart.attr('height', height)
    chart.attr('width', width)

    // Build the X axis
    let x = d3.time.scale()
    x.domain([
      _.min(data, function (item) {
        return item.date
      }).date,
      _.max(data, function (item) {
        return item.date
      }).date
    ])
    x.rangeRound([0, dataWidth])
    let xAxis = d3.svg.axis()
    xAxis.scale(x)
    .orient('bottom')

    // Build the Y axis
    let y = d3.scale.linear()
    y.domain([0, d3.max(data, function (data) {
      return data.total
    })])
    y.range([dataHeight, 0])
    let yAxis = d3.svg.axis()
    yAxis.scale(y)
    .orient('left')
    .tickSize(-dataWidth)

    // Create main data container
    chart.append('g')
    .attr('width', dataWidth)
    .attr('class', 'data')
    .attr('transform', function () {
      return 'translate(' + margin.left + ',' + margin.top + ')'
    })

    // Create data groups
    let bar = chart.select('.data')
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
      return `${d3.time.format('%d %b, %Y')(data.date)} \n ${data.successCount} Successful\n ${data.total - data.successCount} Failed\n`
    })

    // Create failure bar
    bar
    .append('rect')
    .attr('class', 'failure-bar')
    .attr('height', function (data) {
      return dataHeight - y(data.total - data.successCount)
    })
    .attr('width', barWidth)
    .attr('y', function (data) {
      return y(data.total - data.successCount)
    })

    // Create success bar
    bar
    .append('rect')
    .attr('class', 'success-bar')
    .attr('height', function (data) {
      return dataHeight - y(data.successCount)
    })
    .attr('width', barWidth)
    .attr('y', function (data) {
      return y(data.successCount) - (dataHeight - y(data.total - data.successCount))
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
  }

  renderSystemView () {
    // Computed
    let $svg = $('#rescues-by-system')
    let color = d3.scale.category20c()
    let height = $svg.parent().height()
    let width = $svg.parent().width()
    let data = this.rescueSystemData
    let diameter = height > width ? height : width

    let bubble = d3.layout.pack()
    bubble
    .padding(1.5)
    .size([diameter, diameter])
    .sort(null)
    .value(function (data) {
      return data.count
    })

    let chart = d3.select('#rescues-by-system')
    chart.attr('height', diameter)
    chart.attr('width', diameter)

    let node = chart.selectAll('.node')
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
      return data.system + ': ' + data.value
    })

    node.append('circle')
    .attr('r', function (data) {
      return data.r
    })
    .attr('fill', function (data) {
      return color(data.system)
    })

    node.append('text')
    .attr('dy', '.3em')
    .style('text-anchor', 'middle')
    .text(function (data) {
      return data.system.substring(0, data.r / 3)
    })

    $('[data-toggle="tooltip"]').tooltip()
  }
}

new Leaderboard()
