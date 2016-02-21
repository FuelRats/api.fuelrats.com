'use strict';

let websocket = require('../websocket');
let ErrorModels = require('../errors');

exports.subscribe = function(data, client, query) {
    return new Promise(function(resolve, reject) {
        let meta = {};

        let applicationId = websocket.retrieveCaseInsensitiveProperty('applicationId', query);

        if (applicationId && applicationId.length > 0) {

            if (client.subscribedStreams.indexOf(applicationId) === -1) {
                client.subscribedStreams.push(applicationId);
                resolve({
                    data: client.subscribedStreams,
                    meta: meta
                });
            } else {
                let errorModel = ErrorModels.already_exists;
                errorModel.detail = applicationId;
                reject({
                    error: errorModel,
                    meta: {}
                });
            }
        } else {
            let errorModel = ErrorModels.not_found;
            errorModel.detail = applicationId;
            reject({
                error: errorModel,
                meta: {}
            });
        }
    });
};

exports.unsubscribe = function(data, client, query) {
    return new Promise(function(resolve, reject) {
        let meta = {};

        let applicationId = websocket.retrieveCaseInsensitiveProperty('applicationId', query);

        if (applicationId && applicationId.length > 0) {
            let positionInSubscribeList = client.subscribedStreams.indexOf(applicationId);
            if (positionInSubscribeList !== -1) {
                client.subscribedStreams.splice(positionInSubscribeList, 1);
                resolve({
                    data: client.subscribedStreams,
                    meta: meta
                });
            } else {
                let errorModel = ErrorModels.invalid_parameter;
                errorModel.detail = 'Not subscribed to this stream';
                reject({
                    error: errorModel,
                    meta: {}
                });
            }
        } else {
            reject({
                error: 'Invalid application ID',
                meta: {}
            });
        }
    });
};
