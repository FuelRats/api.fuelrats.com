/* eslint-disable jsdoc/require-jsdoc,no-magic-numbers */
/* eslint-env browser */

const ws = new WebSocket('ws://localhost:8082/?bearer=testingadmintoken', 'FR-JSONAPI-WS')

ws.onopen = function (event) {
  console.info('Websocket connection established')
}

ws.onclose = function (event) {
  console.info('Websocket connection closed', event)
}

ws.onmessage = function (event) {
  console.info('Message:', JSON.parse(event.data))
}


ws.onerror = function (event) {
  console.error('Websocket Error', event)
}


function dec2hex (dec) {
  return (`0${dec.toString(16)}`).substr(-2)
}

function randomString (len) {
  const arr = new Uint8Array((len || 40) / 2)
  window.crypto.getRandomValues(arr)
  return Array.from(arr, dec2hex).join('')
}

function send (endpoint, query = {}, data = {}) {
  const state = randomString(16)

  ws.send(JSON.stringify([
    state,
    endpoint,
    query,
    data
  ]))
}
