import { build } from '../routes/Version'
import { Context } from './Context'
import StatusCode from './StatusCode'

/**
 * Class for Server-Side event streams
 * @class
 */
export default class EventStream {
  static subscriptions = []

  /**
   * Create a new Server-Side events stream
   * @param {Context} ctx request context
   */
  constructor (ctx) {
    this.ctx = ctx

    ctx.status = StatusCode.ok

    ctx.type = 'text/event-stream; charset=utf-8'
    ctx.set('Cache-Control', 'no-cache')
    ctx.set('Connection', 'keep-alive')

    ctx.req.on('aborted', this.onClose.bind(this))
    ctx.req.on('error', this.onClose.bind(this))
    ctx.req.on('close', this.onClose.bind(this))
  }

  /**
   * Create a server side events stream from a context
   * @param {Context} ctx request context
   * @returns {Promise<undefined>} returns an indefinite process to keep the Koa connection alive
   */
  static fromConnection (ctx) {
    const eventStream = new EventStream(ctx)
    EventStream.subscriptions.push(eventStream)

    const {
      hash, branch, tags, date, version,
    } = build

    eventStream.send({
      event: 'version',
      data: {
        version,
        commit: hash,
        branch,
        tags,
        date,
      },
    })

    return new Promise((resolve) => {
      this.resolve = resolve
    })
  }

  /**
   * Send an event to all event listeners
   * @param {object} arg function arguments object
   * @param {string} arg.event event name
   * @param {object} arg.data event data
   */
  static sendAll ({ event, data }) {
    EventStream.subscriptions.forEach((stream) => {
      stream.send({ event, data })
    })
  }

  /**
   * Send an event to this subscriber
   * @param {object} arg function arguments object
   * @param {string} arg.event event name
   * @param {object} arg.data event data
   */
  send ({ event, data }) {
    this.ctx.res.write(`event: ${event}\n`)
    if (data) {
      this.ctx.res.write(`data: ${JSON.stringify(data)}\n\n`)
    }
  }

  /**
   * Event fired when an SSE connection is closed for any reason
   */
  onClose () {
    EventStream.subscriptions.splice(EventStream.subscriptions.indexOf(this), 1)
    if (this.resolve) {
      this.resolve()
    }
  }
}
