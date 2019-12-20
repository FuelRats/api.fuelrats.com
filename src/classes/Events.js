import { EventEmitter2 } from 'eventemitter2'

const server = new EventEmitter2({
  wildcard: true
})

export default class Events {
  static broadcast (event, ...args) {
    server.emit(event, ...args)
  }

  static subscribe (event) {
    return function (target, name, descriptor) {
      server.on(event, descriptor.value)
    }
  }
}
