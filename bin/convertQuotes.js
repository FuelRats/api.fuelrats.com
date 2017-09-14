'use strict'

let db = require('../api/db').db
let Rescue = require('../api/db').Rescue
let Client = require('../api/db').Client
let Group = require('../api/db').Group
let bcrypt = require('bcrypt')
let fs = require('fs')
let crypto = require('crypto')


db.sync().then(async function () {
  let rescues = await Rescue.findAll({})
  rescues.map((rescue) => {
    let quotes = rescue.quotes.map((quote) => {
      return {
        message: quote,
        author: null,
        createdAt: null,
        updatedAt: null,
        lastAuthor: null
      }
    })

    Rescue.update({
      quotes2: quotes
    }, {
      where: { id: rescue.id }
    })
  })
})
