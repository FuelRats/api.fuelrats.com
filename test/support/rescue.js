'use strict'
// we are deliberately doing all async functions sequentially to 
// ensure determistic testing
/* eslint-disable no-await-in-loop */
const { extend, omit } = require('underscore')
const { post, put } = require('./request')
const { HTTP_CREATED, HTTP_OK } = require('./const')
const rat = require('./rat')
const { idRegExp } = require('./db')
const BotServ = require('../../api/Anope/BotServ')

/**
 * Create a rescue payload
 * @param auth authentication credentials
 * @param data rescue details
 * @returns {Promise.<void>}
 */
async function create (auth, rescue) {

  const createData = extend({
    client: 'scarlet_pimpernel',
    platform: 'pc',
    system: 'LHS 3447',
    status: 'open'
  }, omit(rescue, 'rats', 'firstLimpet'))

  const createReq = await post(auth, '/rescues', createData)

  if ((createReq.response.statusCode !== HTTP_CREATED) ||
      !createReq.body || !createReq.body.data) {
    throw new Error('Failed to create rescue')
  }

  const newRescue = createReq.body.data

  // assign any rats
  if (rescue.rats && rescue.rats.length) {
    // go find / create the rats if they don't look like id's
    const rats = []
    for (let rr of rescue.rats) {
      rats.push(  
        rr.match(idRegExp) ? rr :
         (await rat.findOrCreate(auth, { name: rr, platform: createData.platform })).id
      )
    }
    await assign(auth, newRescue.id, rats)    
  }

  if (rescue.firstLimpet) {
    // there was a first limpet, so it should be closed
    const updateData = { status: 'closed' }

    if (rescue.firstLimpet.match(idRegExp)) {
      updateData.firstLimpetId = rescue.firstLimpet
    } else {
      // lookup the rat by name for the first limpet
      const firstLimpetRat = await rat.findOrCreate(auth, { name: rescue.firstLimpet, platform: createData.platform })
      updateData.firstLimpetId = firstLimpetRat.id
    }

    // by default the rescue was a success
    if (!rescue.outcome) {
      updateData.outcome = 'success'
    }
    await update(auth, newRescue.id, updateData)
  }

  return createReq.body.data

}

/**
 * Assign rat(s) to a rescue 
 * @param auth authentication credentials
 * @param id rescue id
 * @param rats[] rats to assign
 * @returns {Promise.<void>}
 */
async function assign (auth, id, rats) {

  const assignReq = await put(auth, '/rescues/assign/' + id, rats)

  if ((assignReq.response.statusCode !== HTTP_OK) ||
    !assignReq.body || !assignReq.body.data) {
    throw new Error('Failed to assign rats')
  }

  return assignReq.body.data

}

/**
 * Update rescue 
 * @param auth authentication credentials
 * @param id rescue id
 * @param data rescue data
 * @returns {Promise.<void>}
 */
async function update (auth, id, data) {

  // stub out BotServ
  const oldSay = BotServ.say
  BotServ.say = function () { return null }

  const updateReq = await put(auth, '/rescues/' + id, data)

  // restore BotServ
  BotServ.say = oldSay

  if ((updateReq.response.statusCode !== HTTP_OK) ||
    !updateReq.body || !updateReq.body.data) {
    throw new Error('Failed to update rescue')
  }

  return updateReq.body.data
}

exports.create = create
exports.assign = assign
exports.update = update