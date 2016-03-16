'use strict'

let _ = require('underscore')
let mongoose = require('mongoose')
let winston = require('winston')

let Rat = require('../api/models/rat')
let Rescue = require('../api/models/rescue')

let creates = []
let finds = []
let ratsToCreate = {}
let updates = []

mongoose.connect('mongodb://localhost/fuelrats')

console.log('Loading rescues...')





let createRats = function () {
  Object.keys(ratsToCreate).forEach(function (CMDRname, index) {
    console.log('Creating ' + CMDRname)

    let rescues = ratsToCreate[CMDRname]

    creates.push(new Promise(function (resolve, reject) {
      let create = Rat.create({
        CMDRname: CMDRname
      })

      create.then(function (rat) {
        let saves = []

        rescues.forEach(function (rescue, index) {
          updateRat(rat, rescue)
          updateRescue(rescue, rat)

          saves.push(rescue.save())
        })

        saves.push(rat.save())

        Promise.all(saves)
        .then(resolve)
        .catch(reject)
      })
      .catch(reject)
    }))
  })
}





let handleRatFind = function (results, CMDRname, rescue) {
  console.log('Search for ' + CMDRname + ':')

  // If there's only one match we'll assume it's the correct rat and attribute the rescue to them
  if (results.length === 1) {
    let rat = results[0]

    console.log('Found ' + rat.CMDRname)

    updates.push(new Promise(function (resolve, reject) {
      let saves = []

      updateRescue(rescue, rat)
      updateRat(rat, rescue)

      saves.push(rat.save())
      saves.push(rescue.save())

      Promise.all(saves)
      .then(resolve)
      .catch(reject)
    }))

  // If there are no results, add the rat to a list so we can create them later
  } else if (!results.length) {
    console.log('No results.')

    if (!ratsToCreate[CMDRname]) {
      ratsToCreate[CMDRname] = []
    }

    // Add the rescue ID to the list so we can update it after creating the rat
    ratsToCreate[CMDRname].push(rescue)

  // If we found multiple results, log them to the console so we can handle them manually.
  } else {
    results.forEach(function (rat, index) {
      console.log(rat.CMDRname)
    })
  }

  console.log('')
}





let handleRescue = function (rescue, index, rescues) {
  // Verify that the rescue actually has unidentifiedRats
  if (rescue.unidentifiedRats.length) {
    // Cycle through the rats
    rescue.unidentifiedRats.forEach(function (CMDRname, index) {
      // Do a find to see if we have any matches
      let find = Rat.find({
        $text: {
          $search: CMDRname.replace(/cmdr /i, '').replace(/\s\s+/g, ' ').trim(),
          $caseSensitive: false,
          $diacriticSensitive: false
        }
      })

      find.then(function (results) {
        handleRatFind(results, CMDRname, rescue)
      })
      .catch(console.error)

      finds.push(find)
    })
  }
}





let updateRat = function (rat, rescue) {
  rat.rescues.push(rescue._id)

  return rat
}





let updateRescue = function (rescue, rat) {
  rescue.unidentifiedRats = []

  if (!rescue.firstLimpet) {
    rescue.firstLimpet = rat._id
  } else {
    rescue.rats.push(rat._id)
  }

  return rescue
}





// Find all rescues that still have unidentifiedRats
Rescue.find({
  unidentifiedRats: {
    $exists: true,
    $not: {
      $size: 0
    }
  }
})
.exec()
.then(function (rescues) {
  console.log('Updating rescues...')

  // Cycle through the rescues
  rescues.forEach(handleRescue)

  Promise.all(finds)
  .then(function () {
    Promise.all(updates)
    .then(function () {
      createRats()

      Promise.all(creates)
      .then(function () {
        console.log('Done')
        mongoose.disconnect()
      })
      .catch(console.error)
    })
    .catch(console.error)
  })
  .catch(function (error) {
    console.error(error)
    mongoose.disconnect()
  })
})
.catch(console.error)
