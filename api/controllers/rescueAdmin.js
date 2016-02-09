var _, Rescue, save, winston





_ = require( 'underscore' )
winston = require( 'winston' )
Rescue = require( '../models/rescue' )





// EDIT
// =============================================================================
exports.editRescue = function ( request, response ) {
//  if ( request.isUnauthenticated() ) {
//    response.redirect( '/login' )
//  } else {
    Rescue.findById( request.params.id )
    .populate( 'rats firstLimpet' )
    .then( function ( rescue ) {
      rescue.rats.forEach( function ( rat, index, rats ) {
        if ( rat.CMDRname === rescue.firstLimpet.CMDRname ) {
          rat.firstLimpet = true
        }
      })

      response.render( 'rescue-edit', rescue )
    })
//  }
}





// LIST
// =============================================================================
exports.listRescues = function ( request, response ) {
  var filter, query, rescues

//  if ( request.isUnauthenticated() ) {
//    response.redirect( '/login' )
//  } else {
//  }

  request.params.page = request.params.page || 0

  filter = {
    offset: request.params.page * 25,
    size: 25
  }

  query = {
    match_all: {}
  }

  Rescue.search( query, filter, function ( error, data ) {
    data.hits.hits.forEach( function ( rescue, index, rescues ) {
      rescue._source._id = rescue._id

      rescues.push( rescue._source )
    })

    response.render( 'rescue-list', rescues )
  })
}





// VIEW
// =============================================================================
exports.viewRescue = function ( request, response ) {
  Rescue.findById( request.params.id )
  .populate( 'rats firstLimpet' )
  .then( function ( rescue ) {
    rescue.rats.forEach( function ( rat, index, rats ) {
      if ( rat.CMDRname === rescue.firstLimpet.CMDRname ) {
        rat.firstLimpet = true
      }
    })

    response.render( 'rescue-view', rescue )
  })
}
