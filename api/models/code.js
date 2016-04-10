'use strict'
let mongoose = require('mongoose')

mongoose.Promise = global.Promise

let Schema = mongoose.Schema

let CodeSchema = new Schema({
  value: {
    type: String
  },
  redirectUri: {
    type: String
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: 'Client'
  }
})

let autopopulate = function (next) {
  this.populate('user')
  this.populate('client')
  next()
}

CodeSchema.pre('find', autopopulate)
CodeSchema.pre('findOne', autopopulate)


module.exports = mongoose.model('Code', CodeSchema)
