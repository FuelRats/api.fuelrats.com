'use strict'
let mongoose = require('mongoose')

mongoose.Promise = global.Promise

let Schema = mongoose.Schema

let CodeSchema = new Schema({
  value: {
    type: String,
    required: true
  },
  redirectUri: {
    type: String,
    required: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true
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
