'use strict';

let _ = require('underscore');
let mongoose = require('mongoose');

let Rat = require('../models/rat');
let Rescue = require('../models/rescue');
let ErrorModels = require('../errors');


// GET
// =============================================================================
exports.get = function ( request, response, next ) {

    exports.read(request.query).then( function( res ) {
        let data = res.data;
        let meta = res.meta;

        response.model.data = data;
        response.model.meta = meta;
        response.status = 400;
        next();
    }, function (error) {
        response.model.errors.push(error.error);
        response.status(400);
        next();
    });
};





// GET (by ID)
// =============================================================================
exports.getById = function ( request, response, next ) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params);
    let id = request.params.id;

    Rescue.findById(id).populate('rats').exec(function (error, rescue) {
        if (error) {
            response.model.errors.push(error);
            response.status(400);
        } else {
            response.model.data = rescue;
            response.status(200);
        }

        next();
    });
};


exports.read = function (query) {
    return new Promise(function (resolve, reject) {
        let filter = {};
        let dbQuery = {};

        filter.size = parseInt( query.limit ) || 25;
        delete query.limit;

        filter.from = parseInt( query.offset ) || 0;
        delete query.offset;

        for (var key in query) {
            if ( !dbQuery.bool ) {
                dbQuery.bool = {
                    should: []
                };
            }

            let term = {};
            term[key] = {
                query: query[key],
                fuzziness: 'auto'
            };
            dbQuery.bool.should.push({ match: term });
        }

        if ( !Object.keys( dbQuery ).length ) {
            dbQuery.match_all = {};
        }

        Rescue.search( dbQuery, filter, function (error, queryData) {
            if (error) {
                let errorObj = ErrorModels.server_error;
                errorObj.detail = error;
                reject({ error: errorObj, meta: {} });
            } else {
                let meta = {
                    count: queryData.hits.hits.length,
                    limit: filter.size,
                    offset: filter.from,
                    total: queryData.hits.total
                };

                let data = [];

                queryData.hits.hits.forEach( function (rescue) {
                    rescue._source._id = rescue._id;
                    rescue._source.score = rescue._score;
                    data.push(rescue._source);
                });

                resolve({ data: data, meta: meta });
            }
        });
    });
};



// POST
// =============================================================================
exports.post = function (request, response, next) {
    exports.create( request.body ).then(function( res ) {
        response.model.data = res.data;
        response.status(201);
        next();
    }, function( error ) {
        response.model.errors.push(error);
        response.status(400);
        next();
    });
};

exports.create = function( query ) {
    return new Promise(function(resolve, reject) {
        let finds = [];

        if (typeof query.rats === 'string') {
            query.rats = query.rats.split(',');
        }

        query.unidentifiedRats = [];


        if (query.rats) {
            query.rats.forEach(function (rat) {
                if (typeof rat === 'string') {
                    if ( !mongoose.Types.ObjectId.isValid( rat ) ) {
                        let CMDRname = rat.trim();
                        query.rats = _.without(query.rats, CMDRname);
                        find = Rat.findOne({
                            CMDRname: CMDRname
                        });

                        find.then(function (rat) {
                            if (rat) {
                                query.rats.push(rat._id);
                            } else {
                                query.unidentifiedRats.push(CMDRname);
                            }
                        });

                        finds.push(find);
                    }
                } else if ( typeof rat === 'object' && rat._id ) {
                    query.rats.push(rat._id);
                }
            });
        }

        // Validate and update firstLimpet
        if (query.firstLimpet) {
            if (typeof query.firstLimpet === 'string') {
                if (!mongoose.Types.ObjectId.isValid( query.firstLimpet )) {
                    let firstLimpetFind = Rat.findOne({
                        CMDRname: query.firstLimpet.trim()
                    });

                    firstLimpetFind.then(function (rat) {
                        if (rat) {
                            query.firstLimpet = rat._id;
                        }
                    });
                    finds.push(firstLimpetFind);
                }
            } else if ( typeof query.firstLimpet === 'object' && query.firstLimpet._id ) {
                query.firstLimpet = query.firstLimpet._id;
            }
        }
        Promise.all(finds).then( function () {
            Rescue.create( query, function (error, rescue) {
                if (error) {
                    let errorObj = ErrorModels.server_error;
                    errorObj.detail = error;
                    reject({ error: errorObj, meta: {} });
                } else {
                    resolve ({ data: rescue, meta: {} });
                }
            });
        });
    });
};



// PUT
// =============================================================================
exports.put = function (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params);

    exports.update(request.params, request.body).then(function (data) {
        response.model.data = data.data;
        response.status(201);
        next();
    }, function (error) {
        response.model.errors.push(error);

        var status = error.code || 400;
        response.status(status);
        next();
    });
};

exports.update = function (data, client, query) {
    return new Promise(function (resolve, reject) {
        if (query.id) {
            Rescue.findById(query.id, function(error, rescue) {
                if (error) {
                    let errorModel = ErrorModels.server_error;
                    errorModel.detail = error;
                    reject({ error: errorModel, meta: {}});
                } else if (!rescue) {
                    let errorModel = ErrorModels.not_found;
                    errorModel.detail = query.id;
                    reject({ error: errorModel, meta: {}});
                } else {
                    for (var key in data) {
                        if (key === 'client') {
                            _.extend(rescue.client, data);
                        } else {
                            rescue[key] = data[key];
                        }
                    }

                    rescue.save(function(error, rescue) {
                        if (error) {
                            let errorModel = ErrorModels.server_error;
                            errorModel.detail = error;
                            reject({ error: errorModel, meta: {}});
                        } else {
                            resolve({ data: rescue, meta: {} });
                        }
                    });
                }
            });
        }
    });
};
