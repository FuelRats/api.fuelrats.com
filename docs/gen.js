var aglio = require('aglio')
var winston = require('winston')

var options = {
  themeVariables: 'flatly'
}

aglio.renderFile('src/index.apib', 'docs.html', options, function (err, warnings) {
    if (err) return winston.error(err)
    if (warnings) winston.warn(warnings)
})
