import Document from '.'

export default class DatabaseDocument extends Document {
  constructor ({ query, result, type }) {
    if (result.rows) {
      super({
        objects: result.rows,
        type,
        meta: query.meta,
        query,
        single: false
      })
    } else {
      super({
        objects: result,
        type,
        meta: query.meta,
        query,
        single: true
      })
    }
  }
}
