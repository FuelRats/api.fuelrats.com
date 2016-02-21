'use strict';

let _ = require('underscore');
let User = require('../models/user');
let ErrorModels = require('../errors');

// GET
// =============================================================================
exports.get = function(request, response, next) {
    exports.read(request.body).then(function(res) {
        let data = res.data;
        let meta = res.meta;

        response.model.data = data;
        response.model.meta = meta;
        response.status = 400;
        next();
    }, function(error) {
        response.model.errors.push(error.error);
        response.status(400);
    });
};

// GET (by ID)
// =============================================================================
exports.getById = function(request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params);

    let id = request.params.id;

    User.findById(id).populate('users').exec(function(error, user) {
        if (error) {
            response.model.errors.push(error);
            response.status(400);

        } else {
            response.model.data = user;
            response.status(200);
        }

        next();
    });
};


exports.read = function(query) {
    return new Promise(function(resolve, reject) {
        console.log('attempting read');
        let filter = {};
        let dbQuery = {};

        filter.size = parseInt(query.limit) || 25;
        delete query.limit;

        filter.from = parseInt(query.offset) || 0;
        delete query.offset;

        for (var key in query) {
            if (key === 'q') {
                dbQuery.query_string = {
                    query: query.q
                };
            } else {
                if (!dbQuery.bool) {
                    dbQuery.bool = {
                        should: []
                    };
                }

                let term = {};
                term[key] = {
                    query: query[key],
                    fuzziness: 'auto'
                };
                dbQuery.bool.should.push({
                    match: term
                });
            }
        }

        if (!Object.keys(dbQuery).length) {
            dbQuery.match_all = {};
        }

        console.log('making search');
        User.search(dbQuery, filter, function(error, dbData) {
            console.log('done');
            if (error) {
                console.log('error');
                let errorObj = ErrorModels.server_error;
                errorObj.detail = error;
                reject({
                    error: errorObj,
                    meta: {}
                });

            } else {
                console.log('success');
                let meta = {
                    count: dbData.hits.hits.length,
                    limit: filter.size,
                    offset: filter.from,
                    total: dbData.hits.total
                };
                let data = [];

                dbData.hits.hits.forEach(function(user) {
                    user._source._id = user._id;
                    user._source.score = user._score;

                    data.push(user._source);
                });

                resolve({
                    data: data,
                    meta: meta
                });
            }
        });
    });
};
