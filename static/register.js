
var _, autocompleteFields, limit, options, User, user

limit = 10
autocompleteFields = document.querySelectorAll( '[data-autocomplete="bootstrap"]' )

_.forEach( autocompleteFields, function ( autocompleteField, index, autocompleteFields ) {
  var dropdown, fieldName, parent

  dropdown = document.createElement( 'div' )
  fieldName = autocompleteField.getAttribute( 'name' )
  parent = autocompleteField.parentNode

  dropdown.classList.add( 'dropdown-menu' )
  parent.classList.add( 'dropdown' )
  parent.appendChild( dropdown )

  autocompleteField.addEventListener( 'input', function () {
    var data, url

    data = {
      archive: true,
      limit: limit
    }
    data[fieldName] = autocompleteField.value
    url = 'http://localhost:8080/api/search/rats'

    Object.keys( data ).forEach( function ( key, index, keys ) {
      if ( url.indexOf( '?' ) === -1 ) {
        url = url + '?'
      } else {
        url = url + '&'
      }

      url = url + key + '=' + data[key]
    })

    fetch( url )
    .then( function ( response ) {
      // Convert the response to JSON
      return response.json()
    })
    .then( function ( response ) {
      // Empty the dropdown
      dropdown.innerHTML = ''

      if ( response.data.length ) {
        parent.classList.add( 'open' )

        response.data.forEach( function ( rat, index, rats ) {
          var element

          if ( !rat[fieldName] ) {
            return
          }

          element = document.createElement( 'button' )

          element.setAttribute( 'type', 'button' )
          element.classList.add( 'dropdown-item' )
          element.innerHTML = rat[fieldName]

          dropdown.appendChild( element )

          element.addEventListener( 'click', function ( event ) {
            event.preventDefault()
            autocompleteField.value = element.innerHTML
          })

          element.addEventListener( 'hover', function () {
            dropdown.querySelector( '.highlight' ).classList.remove( 'highlight' )
            element.classList.add( 'highlight' )
          })
        })
      } else {
        parent.classList.remove( 'open' )
      }
    })
  })

  autocompleteField.addEventListener( 'keydown', function ( event ) {
    var highlighted

    highlighted = dropdown.querySelector( '.highlight' )

    switch( event.which ) {
      // Up arrow
      case 40:
        if ( highlighted ) {
          highlighted.classList.remove( 'highlight' )
          if ( highlighted.nextSibling ) {
            highlighted.nextSibling.classList.add( 'highlight' )
          } else {
            dropdown.firstChild.classList.add( 'highlight' )
          }
        } else {
          dropdown.firstChild.classList.add( 'highlight' )
        }
        break

      // Down arrow
      case 38:
        if ( highlighted ) {
          highlighted.classList.remove( 'highlight' )
          if ( highlighted.previousSibling ) {
            highlighted.previousSibling.classList.add( 'highlight' )
          } else {
            dropdown.lastChild.classList.add( 'highlight' )
          }
        } else {
          dropdown.lastChild.classList.add( 'highlight' )
        }

        break

      case 13:
        autocompleteField.value = highlighted.innerHTML
        break
    }
  })

  autocompleteField.addEventListener( 'focus', function () {
    if ( dropdown.childElementCount ) {
      parent.classList.add( 'open' )
    }
  })

  autocompleteField.addEventListener( 'blur', function () {
    setTimeout( function () {
      parent.classList.remove( 'open' )
    }, 100 )
  })
})

//$( 'form' ).submit( function ( event ) {
//  event.preventDefault()
//  console.log( event )
//})
