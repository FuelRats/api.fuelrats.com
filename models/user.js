var modelProperties, mongoose, passportLocalMongoose, Rat, Schema, UserSchema;

mongoose = require( 'mongoose' );
passportLocalMongoose = require( 'passport-local-mongoose' );
Rat = require( './rat' );
Schema = mongoose.Schema;

modelProperties = {
  email: String,
  password: String,
  rat: {
    type: Schema.Types.ObjectId,
    ref: 'Rat'
  }
};

UserSchema = new Schema( modelProperties );

UserSchema.plugin( passportLocalMongoose, {
  usernameField: 'email'
});

module.exports = mongoose.model( 'User', UserSchema );
