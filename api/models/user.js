'use strict'
let mongoose = require('mongoose')

mongoose.Promise = global.Promise

let Schema = mongoose.Schema

let UserSchema = new Schema({
  email: String,
  password: String,
  CMDRs: {
    default: [],
    type: [{
      type: Schema.Types.ObjectId,
      ref: 'Rat'
    }]
  },
  resetToken: String,
  resetTokenExpire: Date
})

let autopopulate = function (next) {
  this.populate('CMDRs')
  next()
}

UserSchema.pre('find', autopopulate)
UserSchema.pre('findOne', autopopulate)

UserSchema.methods.toJSON = function () {
  let obj = this.toObject()
  delete obj.hash
  delete obj.salt
  delete obj.resetToken
  delete obj.resetTokenExpire
  return obj
}

UserSchema.plugin(require('passport-local-mongoose'), {
  usernameField: 'email'
})

module.exports = mongoose.model('User', UserSchema)
