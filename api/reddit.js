
'use strict'

let FeedParser = require('feedparser')
let request = require('request')
let BotServ = require('./Anope/BotServ')

class Reddit {
  constructor () {
    let self = this
    let req = request('https://www.reddit.com/r/FuelRats/new.xml')
    let feedparser = new FeedParser()
    self.items = []

    req.on('response', function () {
      let stream = this

      stream.pipe(feedparser)
    })

    feedparser.on('readable', function () {
      let stream = this

      let item = stream.read()


      while (item !== null) {
        self.items.push(item['atom:id']['#'])
        item = stream.read()
      }

    })

    feedparser.on('end', function () {
      console.log(self.items)
      setTimeout(self.check.bind(self), 60000)
    })
  }

  check () {
    let self = this
    let req = request('https://www.reddit.com/r/FuelRats/new.xml')
    let feedparser = new FeedParser()

    req.on('response', function (res) {
      let stream = this
      stream.pipe(feedparser)
    })

    feedparser.on('readable', function () {
      let stream = this

      let item = stream.read()

      while (item) {
        if (self.items.indexOf(item['atom:id']['#']) === -1) {
          BotServ.say('#ratchat', `${String.fromCharCode(2)}[Reddit] New Post: "${item.title}" ${item.link}`)
          BotServ.say('#rat-ops', `${String.fromCharCode(2)}[Reddit] New Post: "${item.title}" ${item.link}`)
          self.items.push(item['atom:id']['#'])
        }
        item = stream.read()
      }
    })

    feedparser.on('end', function () {
      setTimeout(self.check.bind(self), 60000)
    })
  }
}

module.exports = Reddit