'use strict'
/* global Backbone, _, Bloodhound */

const form = document.querySelector('form')

const arrivedRatsField = document.getElementById('rats')
const firstLimpetField = document.getElementById('firstLimpet')
const systemField      = document.getElementById('system')
const platformPC       = document.getElementById('platform-pc')
const platformXB       = document.getElementById('platform-xb')
const crtrue           = document.getElementById('cr-true')
const crfalse          = document.getElementById('cr-false')
const successfultrue   = document.getElementById('successful-true')
const successfulfalse  = document.getElementById('successful-false')
const notesField       = document.getElementById('notes')

let id = document.querySelector('meta[name=\'rescue-id\']').getAttribute('value')

let engine = new Bloodhound({
  remote: {
    url: '/autocomplete?name=%QUERY',
    wildcard: '%QUERY',
    filter: function (data) {
      var results
      results = data.data.map(function (obj) {
        return { rat: obj.CMDRname, id: obj.id }
      })
      return results
    }
  },
  datumTokenizer: Bloodhound.tokenizers.whitespace,
  queryTokenizer: Bloodhound.tokenizers.whitespace
})

engine.initialize()

$(arrivedRatsField).tagsinput({
  typeaheadjs: {
    name: 'rats',
    displayKey: 'rat',
    source: engine.ttAdapter()
  },
  freeInput: false,
  confirmKeys: [13, 44],
  trimValue: true,
  maxTags: 10,
  itemValue: 'id',
  itemText: 'rat'
})

$(arrivedRatsField).tagsinput('input').blur(function () {
  $('.tt-selectable').trigger('click')
})

$(arrivedRatsField).change(function () {
  $(form).bootstrapValidator('revalidateField', 'rats')
})

$(firstLimpetField).tagsinput({
  typeaheadjs: {
    name: 'firstLimpet',
    displayKey: 'rat',
    source: engine.ttAdapter()
  },
  freeInput: false,
  confirmKeys: [13, 44],
  trimValue: true,
  maxTags: 1,
  itemValue: 'id',
  itemText: 'rat'
})

$(firstLimpetField).tagsinput('input').blur(function () {
  $('.tt-selectable').trigger('click')
})

let systemEngine = new Bloodhound({
  remote: {
    url: 'http://www.edsm.net/typeahead/systems/query/%QUERY',
    minLength: 3,
    wildcard: '%QUERY',
    filter: function (data) {
      var results
      results = data.map(function (obj) {
        return obj.name
      })
      return results
    }
  },
  datumTokenizer: Bloodhound.tokenizers.whitespace,
  queryTokenizer: Bloodhound.tokenizers.whitespace
})

systemEngine.initialize()

$(systemField).typeahead(null, {
  name: 'systems',
  source: systemEngine.ttAdapter()
})

$(systemField).change(function () {
  $(form).bootstrapValidator('revalidateField', 'system')
})


$(form).bootstrapValidator({
  excluded: ':disabled',
  fields: {
    rats: {
      validators: {
        notEmpty: {
          message: 'Please enter at least one rat into the field'
        }
      }
    },
    system: {
      validators: {
        notEmpty: {
          message: 'Please enter the star system to continue'
        }
      }
    }
  }
}).on('success.form.bv', function (e) {
  e.preventDefault()

  let rats = arrivedRatsField.value.split(',').map(function (rat) {
    return rat.trim()
  })

  let updates = {
    rats: rats,
    firstLimpet: firstLimpetField.value,
    system: systemField.value,
    successful: $('input[name="successful"]:checked').val(),
    codeRed: $('input[name="codeRed"]:checked').val(),
    platform: $('input[name="platform"]:checked').val(),
    notes: notesField.value
  }

  let updateRequest = new XMLHttpRequest()
  updateRequest.open('PUT', '/rescues/' + id, true)
  updateRequest.setRequestHeader('Content-Type', 'application/json;charset=UTF-8')
  updateRequest.onload = () => {
    window.location = '/rescues/view/' + id
  }

  updateRequest.onerror = () => {
    console.log(error)
  }

  updateRequest.send(JSON.stringify(updates))
})


let request = new XMLHttpRequest()
request.open('GET', '/rescues/' + id + '?v=2', true)
request.setRequestHeader('Content-Type', 'application/json;charset=UTF-8')
request.onload = () => {
  let rescue = JSON.parse(request.responseText).data

  for (let rat of rescue.rats) {
    $(arrivedRatsField).tagsinput('add', { id: rat.id, rat: rat.CMDRname })
  }

  if (rescue.firstLimpet) {
    $(firstLimpetField).tagsinput('add', { id: rescue.firstLimpet.id, rat: rescue.firstLimpet.CMDRname })
  }

  if (rescue.platform === 'pc') {
    platformPC.checked = true
  } else if (rescue.platform === 'xb') {
    platformXB.checked = true
  }

  if (rescue.system) {
    jQuery(systemField).typeahead('val', rescue.system)
  }

  if (rescue.codeRed === true) {
    crtrue.checked = true
  } else {
    crfalse.checked = true
  }

  if (rescue.successful === true) {
    successfultrue.checked = true
  } else {
    successfulfalse.checked = true
  }

  if (rescue.notes) {
    notesField.value = rescue.notes
  }
}


request.onerror = () => {
  window.close()

}

request.send()
