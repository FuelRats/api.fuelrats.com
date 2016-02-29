'use strict'

/* global Backbone, _, Messenger, Handlebars, Marionette */

$(function () {
  var yepNopeCollection, Rescue, rescue, RatAdderView, RatListItemView, RatListView, DetailsView

  yepNopeCollection = [{
    value: false,
    label: 'No'
  }, {
    value: true,
    label: 'Yes'
  }]

  Messenger.options = {
    extraClasses: 'messenger-fixed messenger-on-bottom messenger-on-left',
    maxMessages: 3,
    messageDefaults: {
      retry: false,
      showCloseButton: true
    },
    theme: 'air'
  }

  Rescue = Backbone.Model.extend({
    idAttribute: '_id',

    initialize: function () {
      this.on('sync', function (model, response) {
        this.set(response.data)
      }, this)
    },

    urlRoot: '/rescues',

    parse: function (response) {
      var rats

      rats = new Backbone.Collection

      if (response.data.rats) {
        rats.add(response.data.rats)
      }

      if (response.data.unidentifiedRats) {
        response.data.unidentifiedRats.forEach(function (rat) {
          rats.add({
            CMDRname: rat
          })
        })
      }

      response.data.rats = rats

      return response.data
    },

    toJSON: function () {
      rescue = _.clone(this.attributes)
      rescue.rats = []
      rescue.unidentifiedRats = []

      this.get('rats').forEach(function (rat) {
        if (rat.id) {
          rescue.rats.push(rat.id)
        } else {
          rescue.unidentifiedRats.push(rat.get('CMDRname'))
        }
      })

      return rescue
    }
  })

  RatAdderView = Marionette.ItemView.extend({
    addRat: function () {
      if (this.ui.addRatInput.val()) {
        rescue.get('rats').add({
          CMDRname: this.ui.addRatInput.val()
        })
        this.ui.addRatInput.val('')
      }
    },

    el: '.rat-adder',

    events: {
      'click @ui.addRatButton': 'addRat'
    },

    template: false,

    ui: {
      addRatButton: 'button.add-rat',
      addRatInput: 'input.add-rat'
    }
  })

  RatListItemView = Marionette.ItemView.extend({
    className: 'list-group-item',

    events: {
      'click @ui.remove': 'onRemove'
    },

    onRemove: function () {
      this.trigger('remove')
    },

    tagName: 'li',

    template: Handlebars.compile(
      '<div class="row">' +
      '<div class="col-md-8">' +
      '{{ CMDRname }}' +
      '</div>' +

      '<div class="col-md-4 text-right">' +
      '<div class="btn-group">' +
      '<button type="button" class="btn btn-sm btn-danger remove">' +
      'Remove' +
      '</button>' +
      '</div>' +
      '</div>' +
      '</div>'
    ),

    ui: {
      remove: '.remove'
    }
  })

  RatListView = Marionette.CollectionView.extend({
    childView: RatListItemView,

    el: '.rat-list',

    childEvents: {
      'remove': 'onChildRemove'
    },

    onChildRemove: function (options) {
      this.collection.remove(options.model)
    }
  })

  DetailsView = Marionette.ItemView.extend({
    bindings: {
      '[name=active]': {
        observe: 'active',
        selectOptions: {
          collection: yepNopeCollection
        }
      },
      '[name=codeRed]': {
        observe: 'codeRed',
        selectOptions: {
          collection: yepNopeCollection
        }
      },
      '[name=notes]': 'notes',
      '[name=open]': {
        observe: 'open',
        selectOptions: {
          collection: yepNopeCollection
        }
      },
      '[name=platform]': 'platform',
      '[name=system]': 'system'
    },

    el: '.rescue-details',

    onRender: function () {
      this.stickit()
    },

    template: false
  })

  rescue = new Rescue({
    _id: location.pathname.replace('/rescues/edit/', '')
  })

  rescue.fetch({
    success: function () {
      new DetailsView({
        model: rescue
      }).render()

      new RatAdderView().render()

      new RatListView({
        collection: rescue.get('rats')
      }).render()
    }
  })

  $('form').submit(function (event) {
    event.preventDefault()

    rescue.save(null, {
      success: function () {
        Messenger().success('Saved')
      },

      error: function () {
        Messenger().error('Ruh-roh... something went wrong. :-(')
      }
    })
  })
})
