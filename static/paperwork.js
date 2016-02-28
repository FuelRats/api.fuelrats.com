'use strict'

/* global Backbone, _, Bloodhound */

$(function () {
  var form, arrivedRatsField, firstLimpetField, engine, systemField, systemEngine
  form = document.querySelector('form')

  arrivedRatsField = document.getElementById('rats')
  firstLimpetField = document.getElementById('firstLimpet')
  systemField      = document.getElementById('system')

  engine = new Bloodhound({
    remote: {
      url: '/rats?CMDRname=%QUERY',
      wildcard: '%QUERY',
      filter: function (data) {
        var results
        results = data.data.map(function (obj) {
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

  systemEngine = new Bloodhound({
    remote: {
      url: 'http://www.edsm.net/api-v1/systems?systemName=%QUERY',
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
        window.location.href = '/rescues/view/' + model.id
      }
    })
  })
})
