'use strict';
let winston = require('winston');
let ErrorModels = require('./errors');

// Import controllers
let rat = require('./controllers/rat');
let rescue = require('./controllers/rescue');
let stream = require('./controllers/stream');
let user = require('./controllers/user');
let version = require('./controllers/version');
let _ = require('underscore');

var APIControllers = {
    rats: rat,
    rescues: rescue,
    stream: stream,
    users: user,
    version: version
};

exports.retrieveCaseInsensitiveProperty = function(propertyName, obj) {
    if (!obj) return null;

    propertyName = propertyName.toLowerCase();

    let caseInsensitivePropertyMap = Object.keys(obj).map(function(prop) {
        return prop.toLowerCase();
    });

    let indexOfProperty = caseInsensitivePropertyMap.indexOf(propertyName);

    if (indexOfProperty !== -1) {
        return obj[Object.keys(obj)[indexOfProperty]];
    }
    return null;
};

exports.socket = null;

exports.received = function(client, requestString) {
    let action, data, requestMeta, request;
    try {
        request = JSON.parse(requestString);

        winston.info(request);

        let requestHasValidAction = false;
        let requestHadActionField = false;
        action      = exports.retrieveCaseInsensitiveProperty('action', request);
        data        = exports.retrieveCaseInsensitiveProperty('data', request);
        requestMeta = exports.retrieveCaseInsensitiveProperty('meta', request);
        if (!requestMeta) requestMeta = {};
        if (!data) data = {};

        if (action) {
            requestHadActionField = true;
            if (typeof action == 'string') {
                requestHasValidAction = action.length > 2 && action.includes(':');
            }
        }

        if (requestHasValidAction === true) {
            let requestSections = action.split(':');
            let namespace = requestSections[0].toLowerCase();

            if (APIControllers.hasOwnProperty(namespace)) {
                let controller = APIControllers[namespace];
                let method = requestSections[1].toLowerCase();
                if (method && controller[method]) {
                    var query = _.clone(request);

                    controller[method].call(null, data, client, query, exports.socket).then(function(response) {
                        let data = response.data;
                        let meta = _.extend(requestMeta, response.meta);
                        meta.action = action;

                        exports.send(client, meta, data);
                    }, function(response) {
                        let error = response.error;
                        let meta = _.extend(requestMeta, response.meta);
                        meta.action = action;

                        exports.error(client, meta, [error]);
                    });
                } else {
                    let error = ErrorModels.invalid_parameter;
                    error.detail = 'action';
                    exports.error(client, {
                        action: action
                    }, [error]);
                }
            } else {
                let applicationId = exports.retrieveCaseInsensitiveProperty('applicationId', request);
                if (!applicationId || applicationId.length === 0) {
                    let error = ErrorModels.invalid_parameter;
                    error.detail = 'applicationId';
                    exports.error(client, {
                        action: action
                    }, [error]);
                    return;
                }

                let callbackMeta = _.extend(requestMeta, {
                    action: 'stream:broadcast',
                    originalAction: action,
                    applicationId: applicationId
                });

                exports.send(client, callbackMeta, data);

                var meta = _.extend(requestMeta, {
                    action: action,
                    applicationId: applicationId
                });

                var clients = exports.socket.clients.filter(function(cl) {
                    return cl.subscribedStreams.indexOf(applicationId) !== -1 && cl !== client;
                });

                exports.broadcast(clients, meta, data);
            }

        } else {
            let error;
            if (requestHadActionField) {
                error = ErrorModels.invalid_parameter;
            } else {
                error = ErrorModels.missing_required_field;
            }

            let meta = _.extend(requestMeta, {
                action: 'unknown'
            });

            error.detail = 'action';
            exports.error(client, meta, [error]);
        }
    } catch (ex) {
        console.log(ex);
        if (!requestMeta) requestMeta = {};
        if (request && action) {
            if (typeof action == 'string') {
                let error = ErrorModels.server_error;
                error.detail = ex.message;

                let meta = _.extend(requestMeta, {
                    action: action
                });

                exports.error(client, meta, [error]);
                return;
            }
        }
        let error = ErrorModels.server_error;
        error.detail = ex.message;

        let meta = _.extend(requestMeta, {
            action: 'unknown'
        });

        exports.error(client, meta, [error]);
    }
};

exports.send = function(client, meta, data) {
    if (meta.hasOwnProperty('action') === false) {
        winston.error('Missing action parameter in meta response.');
        return;
    }

    let response = {
        meta: meta,
        data: data
    };

    client.send(JSON.stringify(response));
};

exports.broadcast = function(clients, meta, data) {
    if (meta.hasOwnProperty('action') === false) {
        winston.error('Missing action parameter in meta response.');
        return;
    }

    let response = {
        meta: meta,
        data: data
    };

    let responseString = JSON.stringify(response);
    clients.forEach(function(client) {
        client.send(responseString);
    });
};

exports.error = function(client, meta, errors) {
    if (meta.hasOwnProperty('action') === false) {
        winston.error('Missing action parameter in meta response.');
        return;
    }

    if (Object.prototype.toString.call(errors) !== '[object Array]') {
        winston.error('Provided error list was not an array');
        return;
    }

    let response = {
        meta: meta,
        errors: errors
    };

    client.send(JSON.stringify(response));
};
