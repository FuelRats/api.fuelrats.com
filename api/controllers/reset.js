'use strict';

let _ = require('underscore');
let path = require('path');
let winston = require('winston');
let nodemailer = require('nodemailer');

let User = require( '../models/user.js');
let uid = require('uid-safe');


exports.get = function (request, response) {
    response.render('reset.swig', request.query);
};

let getPlainTextEmailVersion = function(emaillink) {
    let emailText = '';
    emailText += 'Someone requested a password reset to your FuelRats account.\r\n\r\n';
    emailText += 'To reset your password  copy this link into your browser:\r\n';
    emailText += emaillink + '\r\n\r\n';
    emailText += 'If you ignore this link, your password will not be changed\r\n';
    emailText += '\r\n\r\n\r\n\r\n';
    emailText += 'Regards,\r\n';
    emailText += 'The Fuel Rats\r\n';
    return emailText;
};

exports.post = function (request, response, next) {
    User.findOne({
        email: request.body.email
    }).then(function (user) {
        if (user) {
            let resetToken = uid.sync(16);
            user.resetToken = resetToken;
            user.resetTokenExpire = new Date(Date.now() + 86400000).getTime();

            user.save(function (error) {
                if (error) {
                    response.status(500);
                    next();
                } else {
                    let emailLink = 'http://' + request.headers.host + '/change_password?token=' + resetToken;

                    response.render('reset-email.swig', {emaillink: emailLink}, function(err, emailHTML) {
                        let transporter = nodemailer.createTransport('smtp://orthanc.localecho.net');
                        var mailOptions = {
                            from: 'Fuel Rats (Do Not Reply) <blackhole@fuelrats.com>',
                            to: user.email,
                            subject: 'Fuel Rats Password Reset Requested',
                            text: getPlainTextEmailVersion,
                            html: emailHTML
                        };
                        transporter.sendMail(mailOptions);

                        response.redirect('/login?reset_sent=1');
                    });
                }
            });
        } else {
            response.redirect('/reset?not_found=1');
        }
    });
};
