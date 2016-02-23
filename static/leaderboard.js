'use strict'
/* global d3 */

$(function () {
  generateRescueGraph()
})

function generateRescueGraph () {
  d3.json('/statistics', function (error, json) {
    var x, y, xAxis, yAxis, margin, height, width, colour, svg, rescue, legend, data

    data = json.data[0]

    if (!error) {
      margin = {
        top: 20,
        right: 20,
        bottom: 30,
        left: 40
      }

      width = 960 - margin.left - margin.right
      height = 500 - margin.top - margin.bottom

      x = d3.scale.ordinal().rangeRoundBands([0, width], 0.1)
      y = d3.scale.linear().rangeRound([height, 0])

      xAxis = d3.svg
      .axis()
      .scale(x)
      .orient('bottom')
      .ticks(d3.time.months, 1)
      .tickFormat(d3.time.format('%Y-%m-%d'))
      .tickSize(0)
      .tickPadding(8)

      yAxis = d3.svg
      .axis()
      .scale(y)
      .orient('left')
      .tickFormat(d3.format('.2s'))

      colour = d3.scale.ordinal().range(['#4bb47f', '#e87575'])

      svg = d3.select('body').append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom).append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

      colour.domain(['Success', 'Failure'])

      x.domain(data.map(function (d) {
        return new Date(d.date)
      }))

      y.domain([0, d3.max(data, function (d) {
        return d.success + d.failure
      })])

      svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + height + ')')
      .call(xAxis)

      svg.append('g')
      .attr('class', 'y axis')
      .call(yAxis)
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 6)
      .attr('dy', '.71em')
      .style('text-anchor', 'end')
      .text('Rescues')

      rescue = svg.selectAll('.rescue')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'g')
      .attr('transform', function (d) {
        return 'translate(' + x(new Date(d.date)) + ',0)'
      })

      rescue.selectAll('g')
      .data(function (d) {
        return [d.success, d.failure]
      })
      .enter()
      .append('rect')
      .attr('width', x.rangeBand()).attr('y', function (d) {
        return y(d)
      })
      .attr('height', function (d) {
        console.log( y( d ) )
        return y(d)
      })
      .style('fill', function () {
        return colour(0)
      })

      legend = svg.selectAll('.legend')
      .data(colour.domain().slice().reverse())
      .enter()
      .append('g')
      .attr('class', 'legend')
      .attr('transform', function (d, i) {
        return 'translate(0,' + i * 20 + ')'
      })

      legend.append('rect')
      .attr('x', width - 18)
      .attr('width', 18)
      .attr('height', 18)
      .style('fill', colour)

      legend.append('text')
      .attr('x', width - 24)
      .attr('y', 9)
      .attr('dy', '.35em')
      .style('text-anchor', 'end')
      .text(function (d) {
        return d
      })
    } else {
      console.log(error)
    }
  })
}
