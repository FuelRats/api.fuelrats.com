var _, Rescue, save, winston





_ = require( 'underscore' )
winston = require( 'winston' )
Rescue = require( '../models/rescue' )





// EDIT
// =============================================================================
exports.editRescue = function ( request, response ) {
  Rescue.findById( request.params.id )
  .populate( 'rats firstLimpet' )
  .then( function ( rescue ) {
    rescue.rats.forEach( function ( rat, index, rats ) {
      if ( rat.CMDRname === rescue.firstLimpet.CMDRname ) {
        rat.firstLimpet = true
      }
    })

    response.render( 'rescue-edit' )
  })
}





// LIST
// =============================================================================
exports.listRescues = function ( request, response ) {
  var filter, query, renderVars, rescues

  rescues = []
  renderVars = {}

  if ( !request.params.page || request.params.page < 1 ) {
    request.params.page = 1
  }

  renderVars.page = request.params.page

  if ( request.params.page > 1 ) {
    renderVars.previousPage = request.params.page - 1
  }

  filter = {
    size: 100,
    sort: 'createdAt:desc'
  }

  filter.from = ( request.params.page - 1 ) * filter.size,

  query = {
    match_all: {}
  }

  Rescue.search( query, filter, function ( error, data ) {
    data.hits.hits.forEach( function ( rescue, index ) {
      rescue._source._id = rescue._id
      rescues.push( rescue._source )
    })

    renderVars.count = rescues.length
    renderVars.rescues = rescues
    renderVars.total = data.hits.total
    renderVars.totalPages = Math.ceil( data.hits.total / filter.size )

    if ( renderVars.page < renderVars.totalPages ) {
      renderVars.nextPage = parseInt( request.params.page ) + 1
    }

    response.render( 'rescue-list', renderVars )
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
