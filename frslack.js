'use strict'

const Slack = require('slack-node')

const levelToSlackColor = {
  TRACE: '#8f8f8f',
  DEBUG: '#595959',
  INFO: '#0a79a9',
  WARN: 'warning',
  ERROR: 'danger',
  FATAL: 'danger'
}

function slackAppender (_config, layout, slack) {
  return (loggingEvent) => {
    const data = {
      channel_id: _config.channel_id,
      text: layout(loggingEvent, _config.timezoneOffset),
      icon_url: _config.icon_url,
      username: _config.username
    }

    /* eslint no-unused-vars:0 */
    let attachments = JSON.stringify([{
      fallback: `[${loggingEvent.startTime}] ${ loggingEvent.data[0].detail.name}`,
      color: levelToSlackColor[loggingEvent.level.levelStr],
      title: loggingEvent.data[0].detail.name,
      text: loggingEvent.data[0].detail.stack,
      fields: [
        {
          'title': 'Status',
          'value': loggingEvent.data[0].status,
          'short': true
        },
        {
          'title': 'Code',
          'value': loggingEvent.data[0].code,
          'short': true
        }
      ],
      image_url: 'http://my-website.com/path/to/image.jpg',
      thumb_url: 'http://example.com/path/to/thumb.png',
      footer: 'Development API',
      footer_icon: 'https://s3-us-west-2.amazonaws.com/slack-files2/avatars/2017-08-08/223124196241_3037525c66a75a1f0441_96.png',
      ts: Math.floor(loggingEvent.startTime.getTime() / 1000)
    }])

    slack.api('chat.postMessage', {
      channel: data.channel_id,
      icon_url: data.icon_url,
      username: data.username,
      attachments: attachments
    }, (err, response) => {
      if (err || response.error) {
        throw err
      }
    })
  }
}

function configure (_config, layouts) {
  const slack = new Slack(_config.token)

  let layout = layouts.basicLayout
  if (_config.layout) {
    layout = layouts.layout(_config.layout.type, _config.layout)
  }

  return slackAppender(_config, layout, slack)
}

module.exports.configure = configure