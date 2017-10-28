'use strict'
// we are deliberately doing all async functions sequentially to 
// ensure determistic testing
/* eslint-disable no-await-in-loop */
const { extend, omit } = require('underscore')
const { POST, PUT, Request } = require('../../api/classes/Request')
const { HTTP_CREATED, HTTP_OK } = require('./const')
const rat = require('./rat')
const { idRegExp } = require('./db')
const BotServ = require('../../api/Anope/BotServ')

/**
 * Create a rescue payload
 * @param auth authentication credentials
 * @param rescue rescue details
 * @returns {Promise.<void>}
 */
async function create (auth, rescue) {

  const payload = extend({
    client: 'scarlet_pimpernel',
    platform: 'pc',
    system: 'LHS 3447'
  }, omit(rescue, 'rats', 'firstLimpet', 'status', 'outcome'))

  const post = await new Request(POST, {
    path: '/rescues',
    insecure: true,
    headers: { 'Cookie': auth }
  }, payload)

  if ((post.response.statusCode !== HTTP_CREATED) ||
      !post.body || !post.body.data) {
    throw new Error('Failed to create rescue')
  }

  const newRescue = post.body.data

  // assign any rats
  if (rescue.rats && rescue.rats.length) {
    // go find / create the rats if they don't look like id's
    const rats = []
    for (let rr of rescue.rats) {
      rats.push(  
        rr.match(idRegExp) ? rr :
         (await rat.findOrCreate(auth, { name: rr, platform: payload.platform })).id
      )
    }
    await assign(auth, { id: newRescue.id, rats: rats })    
  }

  const rUpdate = {
    status: rescue.status || 'open',
    outcome: rescue.outcome
  }

  if (rescue.firstLimpet) {
    rUpdate.firstLimpetId = rescue.firstLimpet.match(idRegExp) ?
    rescue.firstLimpet : (await rat.findOrCreate(auth, { name: rescue.firstLimpet, platform: payload.platform })).id
    if (!rescue.outcome) {
      rUpdate.outcome = 'success'
    }
    if (!rescue.status) {
      rUpdate.status = 'closed'
    }
  }

  await update(auth, { id: newRescue.id, data: rUpdate})

  return post.body.data

}

/**
 * Assign rat(s) to a rescue 
 * @param auth authentication credentials
 * @param rats[] rescue rats
 * @returns {Promise.<void>}
 */
async function assign (auth, rescue) {

  const put = await new Request(PUT, {
    path: '/rescues/assign/' + rescue.id,
    insecure: true,
    headers: { 'Cookie': auth }
  }, rescue.rats)

  if ((put.response.statusCode !== HTTP_OK) ||
    !put.body || !put.body.data) {
    throw new Error('Failed to assign rats')
  }

  return put.body.data

}

/**
 * Update rescue 
 * @param auth authentication credentials
 * @param rescue.id
 * @param rescue.data
 * @returns {Promise.<void>}
 */
async function update (auth, rescue) {

  const oldSay = BotServ.say
  BotServ.say = function () { return null }

  const put = await new Request(PUT, {
    path: '/rescues/' + rescue.id,
    insecure: true,
    headers: { 'Cookie': auth }
  }, rescue.data)

  BotServ.say = oldSay

  if ((put.response.statusCode !== HTTP_OK) ||
    !put.body || !put.body.data) {
    throw new Error('Failed to update rescue')
  }

  return put.body.data
}

exports.create = create
exports.assign = assign
exports.update = update