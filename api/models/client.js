'use strict'
let mongoose = require('mongoose')

mongoose.Promise = global.Promise

let Schema = mongoose.Schema

let ClientSchema = new Schema({
  name: {
    type: String,
    unique: true
  },
  secret: {
    type: String
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
})

let autopopulate = function (next) {
  this.populate('user')
  next()
}

ClientSchema.pre('find', autopopulate)
ClientSchema.pre('findOne', autopopulate)



ClientSchema.methods.toJSON = function () {
  let obj = this.toObject()
  delete obj.secret
  delete obj.hash
  delete obj.salt
  return obj
}

ClientSchema.plugin(require('passport-local-mongoose'), {
  usernameField: 'name',
  passwordField: 'secret'
})

module.exports = mongoose.model('Client', ClientSchema)
