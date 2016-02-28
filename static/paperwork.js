'use strict'

/* global Backbone, _, Bloodhound */

$(function () {
  let form = document.querySelector('form')

  let arrivedRatsField = document.getElementById('rats')
  let firstLimpetField = document.getElementById('firstLimpet')

  let engine = new Bloodhound({
    remote: {
      url: '/rats?CMDRname=%QUERY',
      wildcard: '%QUERY',
      filter: function (data) {
        let results = data.data.map(function (obj) {
          return { rat: obj.CMDRname, id: obj._id }
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

  form.addEventListener('submit', function (event) {
    var Rescue, rescue

    event.preventDefault()

    Rescue = Backbone.Model.extend({
      url: 'rescues',
      parse: function (response) {
        return response.data
      }
    })

    rescue = new Rescue

    _.forEach(document.querySelectorAll('input, textarea'), function (element) {
      if (element.getAttribute('type') === 'radio' || element.getAttribute('type') === 'checkbox') {
        if (!element.checked) {
          return
        }
      }

      if (element.getAttribute('name') === 'rats') {
        rescue.set(element.getAttribute('name'), element.value.split(','))
      } else {
        rescue.set(element.getAttribute('name'), element.value)
      }

    })

    rescue.save({}, {
      success: function (model) {
        window.location.href = '/rescues/' + model.id
      }
    })
  })
})
