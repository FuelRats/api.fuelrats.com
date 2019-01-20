export default class DatabaseDocument {
  #query = null
  #objects = null
  #type = null

  constructor ({ query, result, type = null }) {
    this.#query = query
    this.#objects = result.rows || result
    this.#type = type
  }
}
