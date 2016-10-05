'use strict'


class API {


  static createQueryFromRequest (request) {
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

  static route (route) {
    return function (request, response, next) {
      response.header('X-API-Version', request.version)
      response.header('X-Rate-Limit-Limit', 100)
      response.header('X-Rate-Limit-Remaining', 98)
      response.header('X-Rate-Limit-Reset', '2016-10-05T21:00:00+00')

      let params = Object.assign(request.query, request.params)

      route(params, request, request.body).then(function (result) {
        response.status(200).send({
          links: {
            self: request.originalUrl
          },
          meta: {
            method: request.method,
            params: Object.assign(request.query, request.params),
            timestamp: new Date().toISOString()
          },
          data: result
        })
      }).catch(function (error) {
        console.log(error)
        next(error)
      })
    }
  }

  static version (version) {
    return function (req, res, next) {
      req.version = version
      next()
    }
  }
}

module.exports = API
