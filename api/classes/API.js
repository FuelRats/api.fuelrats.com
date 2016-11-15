'use strict'

class API {
  static createQueryFromRequest (req) {
    let request = Object.assign({}, req)
    delete request.rats
    delete request.CMDRs

    let limit = parseInt(request.limit) || 25
    delete request.limit

    let offset = (parseInt(request.page) - 1) * limit || parseInt(request.offset) || 0
    delete request.offset
    delete request.page

    let order = request.order || 'createdAt'
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

    let query = {
      where: request,
      order: [
        [order, direction]
      ],
      limit: limit,
      offset: offset,
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
