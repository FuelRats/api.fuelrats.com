var mongoose,
    QuoteSchema,
    Schema,
    winston

mongoose = require( 'mongoose' )
winston = require( 'winston' )

mongoose.Promise = global.Promise

Schema = mongoose.Schema





QuoteSchema = new Schema({
  author: {
    type: String
  },
  message: {
    required: true,
    type: String
  }
}, {
  versionKey: false
})





if ( mongoose.models.Quote ) {
  module.exports = mongoose.model( 'Quote' )
} else {
  module.exports = mongoose.model( 'Quote', QuoteSchema )
}
