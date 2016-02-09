$( function () {
  var autocompleteFields, limit, options, User, user

  limit = 10
  autocompleteFields = document.querySelectorAll( '[data-autocomplete]' )

  _.forEach( autocompleteFields, function ( autocompleteField, index, autocompleteFields ) {
    var dropdown, fieldNames, parent

    dropdown = document.createElement( 'div' )
    fieldNames = autocompleteField.getAttribute( 'data-autocomplete' )
    parent = autocompleteField.parentNode

    dropdown.classList.add( 'dropdown-menu' )
    parent.classList.add( 'dropdown' )
    parent.appendChild( dropdown )

    if ( fieldNames.indexOf( '|' ) !== -1 ) {
      fieldNames = fieldNames.split( '|' )
    } else {
      fieldNames = [fieldNames]
    }

    autocompleteField.addEventListener( 'input', function () {
      var data, requests

      data = {
        archive: true,
        limit: limit
      }
      requests = []

      fieldNames.forEach( function ( fieldName, index, fieldNames ) {
        var url

        data[fieldName] = autocompleteField.value
        url = '/rats'

        Object.keys( data ).forEach( function ( key, index, keys ) {
          if ( url.indexOf( '?' ) === -1 ) {
            url = url + '?'
          } else {
            url = url + '&'
          }

          url = url + key + '=' + data[key]
        })

        requests.push( fetch( url ) )
        delete data[fieldName]
      })

      Promise.all( requests )
      .then( function ( responses ) {
        return new Promise( function ( resolve, reject ) {
          var jsonConversions = []

          // Convert the responses to JSON
          responses.forEach( function ( response, index, responses ) {
            jsonConversions.push( response.json() )
          })

          Promise.all( jsonConversions )
          .then( resolve )
          .catch( reject )
        })
      })
      .then( function ( responses ) {
        var responseData

        responseData = []

        // Empty the dropdown
        dropdown.innerHTML = ''

        // Combine and dedupe responses
        for ( var i = 0; i < responses.length; ) {
          responseData = _.union( responseData, responses.shift().data )
        }

        // Sort
        responseData = _.sortBy( responseData, 'score' )

        // Reverse
        responseData = responseData.reverse()

        // Minify
        responseData = _.forEach( responseData, function ( responseDatum, index, responseData ) {
          fieldNames.forEach( function ( fieldName, index, fieldNames ) {
            if ( responseDatum[fieldName] ) {
              responseData.push( responseDatum[fieldName] )
            }
          })
        })

        // Remove stale objects
        responseData = _.filter( responseData, function ( datum ) {
          return typeof datum !== 'object'
        })

        // Reduce
        responseData = _.uniq( responseData )
        responseData = _.take( responseData, 10 )

        if ( responseData.length ) {
          parent.classList.add( 'open' )

          responseData.forEach( function ( datum, index, data ) {
            var element

            element = document.createElement( 'button' )

            element.setAttribute( 'type', 'button' )
            element.setAttribute( 'tabindex', '-1' )
            element.classList.add( 'dropdown-item' )
            element.innerHTML = datum

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
})
