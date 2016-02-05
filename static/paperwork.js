$( function () {
  var form

  form = document.querySelector( 'form' )

  form.addEventListener( 'submit', function ( event ) {
    var Rescue, rescue

    event.preventDefault()

    Rescue = Backbone.Model.extend({
      url: 'rescues',
      parse: function ( response ) {
        return response.data
      }
    })

    window.rescue = rescue = new Rescue

    _.forEach( document.querySelectorAll( 'input, textarea' ), function ( element, index, elements ) {
      if ( element.getAttribute( 'type' ) === 'radio' || element.getAttribute( 'type' ) === 'checkbox' ) {
        if ( !element.checked ) {
          return
        }
      }

      rescue.set( element.getAttribute( 'name' ), element.value )
    })

    rescue.save( {}, {
      success: function ( model ) {
        window.location.href = '/rescue/' + model.id
        console.log( 'model:', model )
      }
    })
  })
})
