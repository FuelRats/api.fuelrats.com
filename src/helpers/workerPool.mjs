/**
 * Create a worker pool that wraps a Bun Worker with a promise-based exec interface.
 * @param {string} workerUrl path to the worker module (relative to caller)
 * @param {string} baseUrl import.meta.url of the calling module
 * @returns {{exec: Function}} worker pool with exec method
 */
export function createWorkerPool (workerUrl, baseUrl) {
  const worker = new Worker(new URL(workerUrl, baseUrl))
  let nextId = 0
  const pending = new Map()

  worker.onmessage = (event) => {
    const { id, result, error } = event.data
    const handler = pending.get(id)
    if (!handler) {
      return
    }
    pending.delete(id)
    if (error) {
      handler.reject(new Error(error))
    } else {
      handler.resolve(result)
    }
  }

  worker.onerror = (error) => {
    // Reject all pending requests on worker error
    for (const [id, handler] of pending) {
      handler.reject(error)
      pending.delete(id)
    }
  }

  return {
    /**
     * Execute a task in the worker
     * @param {object} data data to send to the worker
     * @returns {Promise<*>} result from the worker
     */
    exec (data) {
      return new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, { resolve, reject })
        worker.postMessage({ id, ...data })
      })
    },
  }
}
