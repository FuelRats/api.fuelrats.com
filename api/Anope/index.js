'use strict'

const xmlrpc = require('homematic-xmlrpc')
const sslRootCAs = require('ssl-root-cas/latest')
  .addFile(__dirname + '/../../ca/lets-encrypt-x1-cross-signed.pem')
  .addFile(__dirname + '/../../ca/lets-encrypt-x2-cross-signed.pem')
  .addFile(__dirname + '/../../ca/lets-encrypt-x3-cross-signed.pem')
  .addFile(__dirname + '/../../ca/lets-encrypt-x4-cross-signed.pem')
sslRootCAs.inject()

const client = xmlrpc.createSecureClient('https://irc.eu.fuelrats.com:6080/xmlrpc')


module.exports = { client }
