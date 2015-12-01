var mongoose, RatSchema, Schema;

mongoose = require( 'mongoose' );
Schema = mongoose.Schema;

RatSchema = new Schema({
  'CMDRname': {
    type: String
  },
  'gamertag': {
    type: String
  },
  'nickname': {
    required: true,
    type: String
  },
  'drilled': {
    default: false,
    type: Boolean
  }
});

RatSchema.index({
  'CMDRname': 'text',
  'gamertag': 'text',
  'nickname': 'text'
});

RatSchema.set( 'toJSON', {
  virtuals: true,
  transform: function ( document, ret, options ) {
    ret.id = ret._id;
    delete ret._id;
  }
});

module.exports = mongoose.model( 'Rat', RatSchema );
