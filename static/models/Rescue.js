var RescueModel

RescueModel = BaseModel.extend({
  initialize: function () {
    this.on( 'sync', function ( model, response, options ) {
      this.set( response.data )
    }, this )
  },

  urlRoot: '/rescues',

  parse: function ( response ) {
    var rats

    if ( response.data ) {
      rats = new Backbone.Collection

      if ( response.data.rats ) {
        rats.add( response.data.rats )
      }

      if ( response.data.unidentifiedRats ) {
        response.data.unidentifiedRats.forEach( function ( rat ) {
          rats.add( { CMDRname: rat } )
        })
      }

      response.data.rats = rats

      return response.data
    } else {
      return response
    }
  },

  toJSON: function () {
    var rats, rescue

    rescue = _.clone( this.attributes )
    rescue.rats = []
    rescue.unidentifiedRats = []

    this.get( 'rats' ).forEach( function ( rat, index, rats ) {
      if ( rat.id ) {
        rescue.rats.push( rat.id )
      } else {
        rescue.unidentifiedRats.push( rat.get( 'CMDRname' ) )
      }
    })

    return rescue
  }
})
