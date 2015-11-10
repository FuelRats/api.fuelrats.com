var mongoose, RatSchema, Schema;

mongoose = require( 'mongoose' );
Schema = mongoose.Schema;

RatSchema = new Schema({
  'CMDRname': {
    type: String,
    index: 'text'
  },
  'nickname': {
    required: true,
    type: String,
    index: 'text'
  },
  'platform': {
    default: 'PC',
    type: String
  }
});

RatSchema.set( 'toJSON', { virtuals: true } );

module.exports = mongoose.model( 'Rat', RatSchema );
