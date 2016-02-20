var modelProperties, mongoose, passportLocalMongoose, Rat, Schema, UserSchema;

mongoose = require( 'mongoose' );
passportLocalMongoose = require( 'passport-local-mongoose' );
Rat = require( './rat' );
Schema = mongoose.Schema;

modelProperties = {
  email: String,
  password: String,
  CMDRs: {
    default: [],
    type: [{
      autopopulate: true,
      type: Schema.Types.ObjectId,
      ref: 'Rat'
    }]
  },
  resetToken: String,
  resetTokenExpire: Date
};

UserSchema = new Schema( modelProperties );

UserSchema.methods.toJSON = function () {
  obj = this.toObject();
  delete obj.hash;
  delete obj.salt;
  return obj;
};

//UserSchema.plugin( require( 'mongoose-autopopulate' ) );

UserSchema.plugin( passportLocalMongoose, {
  usernameField: 'email'
});

module.exports = mongoose.model( 'User', UserSchema );
