'use strict'

class API {
  static createQueryFromRequest (request) {
    let limit = parseInt(request.limit) || 25
    delete request.limit

    let offset = parseInt(request.offset) || 0
    delete request.offset

    let order = parseInt(request.order) || 'createdAt'
    delete request.order
    let direction = request.direction || 'ASC'
    delete request.direction

    if (request.firstLimpet) {
      request.firstLimpetId = request.firstLimpet
      delete request.firstLimpet
    }

    if (request.data) {
      let dataQuery = request.data
      delete request.data

      request.data = {
        $contains: JSON.parse(dataQuery)
      }
    }

    if (request.nicknames) {
      request.nicknames = { $contains: [request.nicknames] }
    }

    let query = {
      where: request,
      limit: limit,
      offset: offset,
      order: [
        [order, direction]
      ]
    }

    return query
  }

  static version (version) {
    return function (req, res, next) {
      req.apiVersion = version
      next()
    }
  }
}

module.exports = API
