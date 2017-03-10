'use strict'

let Errors = require('../errors')
let https = require('https')
let config = require('../../config')
let xml = require('xml2js')


const jiraauth = new Buffer(`${config.jira.username}:${config.jira.password}`).toString('base64')

class News {
  static list (params, connection) {
    return new Promise(function (resolve, reject) {
      https.get({
        host: 'confluence.fuelrats.com',
        path: '/rest/api/content?title=Fuel%20Rats%20Knowledge%20Base&spaceKey=FRKB&expand=body.storage&representation=wiki',
        headers: {
          'Authorization': `Basic ${jiraauth}`
        }
      }, function (response) {
        let body = ''

        response.on('data', function (data) {
          body += data
        })

        response.on('end', function () {
          let data = JSON.parse(body)
          let xmlString = data.results[0].body.storage.value
          if (!xmlString) {

          }

          xml.parseString(xmlString, function (err, result) {
            if (err) {
              console.log(err)
              return
            }

            let builder = new xml.Builder({headless: true})
            let xmlArticles = result['ac:layout']['ac:layout-section'][0]['ac:layout-cell'][0]['ac:structured-macro']
            let articles = []

            for (let xmlArticle of xmlArticles) {
              let article = {}
              article.title = xmlArticle['ac:parameter'][0]['_']
              article.body = builder.buildObject(xmlArticle['ac:rich-text-body'][0])
              articles.push(article)
            }

            console.log(articles)
          })
        })
      })
    })
  }
}

module.exports = News