
var CMDRname, Rat, rat, Rescue, Rescues, rescues, renderBadge

renderBadge = function renderBadge ( rat, rescues ) {
  var rescueCount, ui

  // Prevent performance loss from multiple accesses by caching references to DOM elements
  ui = {
    badge: document.querySelector( '#badge' ),
    codeRed: document.querySelector( '#codeRed' ),
    crown1: document.querySelector( '#crown1' ),
    crown2: document.querySelector( '#crown2' ),
    dispatch: document.querySelector( '#dispatch' ),
    firstYear: document.querySelector( '#firstYear' ),
    rescue1: document.querySelector( '#rescues1' ),
    rescue2: document.querySelector( '#rescues2' ),
    rescue3: document.querySelector( '#rescues3' ),
    rescue4: document.querySelector( '#rescues4' )
  }

  // Count the rat's rescues so we can conditionally remove rescue elements from the badge
  rescueCount = rat.get( 'rescues' ).length

  if ( rescueCount < 1000 ) {
    ui.crown2.classList.add( 'hidden' )
  } else {
    ui.crown2.classList.remove( 'hidden' )
  }

  if ( rescueCount < 500 ) {
    ui.crown1.classList.add( 'hidden' )
  } else {
    ui.crown1.classList.remove( 'hidden' )
  }

  if ( rescueCount < 400 ) {
    ui.rescue4.classList.add( 'hidden' )
  } else {
    ui.rescue4.classList.remove( 'hidden' )
  }

  if ( rescueCount < 200 ) {
    ui.rescue2.classList.add( 'hidden' )
    ui.rescue3.classList.add( 'hidden' )
  } else {
    ui.rescue2.classList.remove( 'hidden' )
    ui.rescue3.classList.remove( 'hidden' )
  }

  if ( rescueCount < 100 || ( 199 < rescueCount && rescueCount < 300 ) ) {
    ui.rescue1.classList.add( 'hidden' )
  } else {
    ui.rescue1.classList.remove( 'hidden' )
  }

  // Check if the rat has been dispatch drilled
  if ( !rat.get( 'drilled' ).dispatch ) {
    ui.dispatch.classList.add( 'hidden' )
  } else {
    ui.dispatch.classList.remove( 'hidden' )
  }

  // Check if the rat has ever been on a code red rescue
  if ( !_.findWhere( rat.get( 'rescues' ), { codeRed: true } ) ) {
    ui.codeRed.classList.add( 'hidden' )
  } else {
    ui.codeRed.classList.remove( 'hidden' )
  }

  if ( rat.get( 'joined' ).isAfter( '2015' ) ) {
    ui.firstYear.classList.add( 'hidden' )
  } else {
    ui.firstYear.classList.remove( 'hidden' )
  }

  // We're done processing, time to show the badge!
  ui.badge.classList.add( 'focusIn' )
}

Rat = Backbone.Model.extend({
  defaults: {
    CMDRname: null,
    drilled: {
      dispatch: false,
      rescue: false
    },
    joined: 0,
    rescues: []
  },
  parse: function ( response ) {
    return response.data[0]
  },
  url: '/api/rats',
  initialize: function () {
    rescues = new Rescues

    this.once( 'sync', ( model, response, jqxhr ) => {
      this.set( 'joined', moment( this.get( 'joined' ) ) )

      rescues
      .fetch( { data: $.param( { rats: this.CMDRname } ) } )
      .then( ( response, status, xhr ) => {
        this.set( 'rescues', rescues )
      })
    })
  }
})

Rescue = Backbone.Model.extend({
  defaults: {}
})

Rescues = Backbone.Collection.extend({
  model: Rescue,
  parse: function ( response ) {
    return response.data
  },
  url: '/api/rescues'
})

CMDRname = location.pathname.replace( '/', '' ).split( '/' )[1]

rat = new Rat

rat.fetch( { data: $.param( { CMDRname: CMDRname } ) } )

rat.on( 'sync', () => {
  renderBadge( rat )
})
