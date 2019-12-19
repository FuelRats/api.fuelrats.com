/* eslint-disable jsdoc/require-jsdoc */
/* eslint-env browser */

const ws = new WebSocket('ws://localhost:8082', 'FR-JSONAPI-WS')

ws.onopen = function (event) {
  console.info('Websocket connection established')
}

ws.onclose = function (event) {
  console.info('Websocket connection closed', event)
}

ws.onmessage = function (event) {
  console.info('Message:', event.data)
}


ws.onerror = function (event) {
  console.error('Websocket Error', event)
}

const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
function randomString (length) {
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)

  return values.map((value) => {
    return charset[value % charset.length]
  })
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
