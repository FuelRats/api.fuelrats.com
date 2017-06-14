'use strict'

const nodemailer = require('nodemailer')

const User = require('../db').User
const Reset = require('../db').Reset
const crypto = require('crypto')


exports.get = function (request, response) {
  response.render('reset.swig', request.query)
}

let getPlainTextEmailVersion = function (emaillink) {
  let emailText = ''
  emailText += 'Someone requested a password reset to your FuelRats account.\r\n\r\n'
  emailText += 'To reset your password  copy this link into your browser:\r\n'
  emailText += emaillink + '\r\n\r\n'
  emailText += 'If you ignore this link, your password will not be changed\r\n'
  emailText += '\r\n\r\n\r\n\r\n'
  emailText += 'Regards,\r\n'
  emailText += 'The Fuel Rats\r\n'
  return emailText
}

exports.post = function (request, response) {
  if (!request.body.email) {
    response.redirect('/reset?not_found=1')
  }

  User.findOne({ where: {
    email: { $iLike: request.body.email }
  }}).then(function (user) {
    if (!user) {
      response.redirect('/reset?not_found=1')
    }

    Reset.findAll({
      where: {
        userId: user.id
      }
    }).then(function (resets) {
      for (let reset of resets) {
        reset.destroy()
      }

      Reset.create({
        value: crypto.randomBytes(16).toString('hex'),
        expires:  new Date(Date.now() + 86400000).getTime(),
        userId: user.id
      }).then(function (reset) {
        let emailLink = 'https://' + request.headers.host + '/change_password?token=' + reset.value

        response.render('reset-email.swig', {emaillink: emailLink}, function (err, emailHTML) {
          let transporter = nodemailer.createTransport('smtp://orthanc.localecho.net')
          var mailOptions = {
            from: 'Fuel Rats (Do Not Reply) <fuelrats@localecho.net>',
            to: user.email,
            subject: 'Fuel Rats Password Reset Requested',
            text: getPlainTextEmailVersion,
            html: emailHTML
          }
          transporter.sendMail(mailOptions)

          response.redirect('/login?reset_sent=1')
        })
      }).catch(function (error) {

      })
    })


  }).catch(function (error) {

  })
}
