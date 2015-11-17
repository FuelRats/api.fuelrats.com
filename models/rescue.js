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
  'codeRed': {
    default: false,
    type: Boolean
  },
  'nickname': {
    index: 'text',
    required: true,
    type: String
  },
  'open': {
    default: true,
    type: Boolean
  },
  'nearestSystem': {
    type: String
  },
  'platform': {
    default: 'PC',
    type: String
  },
  'rats': {
    type: [{
      type: String
    }]
  },
  'stage': {
    type: String
  },
  'system': {
    type: String
  }
});

RescueSchema.pre( 'save', function ( next ) {
  if ( !this.open ) {
    this.active = false;
  }

  next();
});

//RescueSchema.index( { '$**': 'text' } );
RescueSchema.set( 'toJSON', {
  virtuals: true,
   transform: function ( document, ret, options ) {
     ret.id = ret._id;
     delete ret._id;
   }
});

//RescueSchema.methods.toJSON = function () {
//  var obj;
//
//  obj = this.toObject();
//
//  //delete obj._id;
//
//  return obj;
//}

module.exports = mongoose.model( 'Rescue', RescueSchema );
