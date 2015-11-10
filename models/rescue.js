var mongoose, RescueSchema, Schema;

mongoose = require( 'mongoose' );
Schema = mongoose.Schema;

RescueSchema = new Schema({
  'active': {
    default: true,
    type: Boolean
  },
  'CMDRname': {
    index: 'text',
    type: String
  },
  'nickname': {
    index: 'text',
    required: true,
    type: String
  },
  'codeRed': {
    default: false,
    type: Boolean
  },
  'nearestSystem': String,
  'platform': {
    default: 'PC',
    type: String
  },
  'rats': [String],
  'stage': String,
  'system': String
});

//RescueSchema.index( { '$**': 'text' } );
RescueSchema.set( 'toJSON', { virtuals: true } );

module.exports = mongoose.model( 'Rescue', RescueSchema );
