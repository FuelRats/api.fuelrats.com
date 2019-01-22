import Document from '.'

export default class DatabaseDocument extends Document {
  constructor ({ query, result, type = undefined }) {
    super({
      objects: result.rows || result,
      type: type,
      meta: {},
      query: query
    })
  }
}
