import EventEmitters from 'eventemitter2'

const { EventEmitter2 } = EventEmitters

const server = new EventEmitter2({
  wildcard: true
})

/**
 * Event Manager
 */
export default class Event {
  /**
   * Broadcast an event
   * @param {string} event event name
   * @param {...object} args event arguments
   */
  static broadcast (event, ...args) {
    server.emit(event, ...args)
  }
}

/**
 * Decorator for a function to listen to an event
 * @param {string} event
 * @returns {function(...[*]=)}
 */
export function listen (event) {
  return function (target, name, descriptor) {
    server.on(event, descriptor.value)
  }
}
