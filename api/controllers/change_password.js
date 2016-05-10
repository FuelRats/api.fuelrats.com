'use strict';

let _ = require('underscore');
let path = require('path');
let winston = require('winston');
let nodemailer = require('nodemailer');

let User = require( '../models/user.js');


exports.get = function (request, response) {
    User.findOne({
        resetToken: request.query.token
    }).then(function (user) {
        if (user && user.resetTokenExpire.getTime() > Date.now()) {
            response.render('change_password.swig', request.query);
        } else {
            response.redirect('/reset?expired=1');
        }
    });
};


exports.post = function (request, response, next) {
    User.findOne({
        resetToken: request.body.token
    }).then(function (user) {
        if (user) {
            if (user.resetTokenExpire.getTime() > Date.now()) {
                user.setPassword(request.body.password, function() {
                    user.save(function (error) {
                        if (error) {
                            response.status(500);
                            next();
                        } else {
                            response.redirect('/login?password_changed=1');
                        }
                    });
                });
            } else {
                response.redirect('/reset?expired=1');
            }
        } else {
            response.redirect('/reset?expired=1');
        }
    });
};
