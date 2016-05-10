'use strict'

exports.sendCommandWithValues = function (values) {
  let methodCallNode = document.implementation.createDocument('', 'methodCall', null)

  let methodNameNode = document.createElementNS(null, 'methodName')
  methodNameNode.textContent = 'command'
  methodCallNode.documentElement.appendChild(methodNameNode)

  let paramsNode = document.createElementNS(null, 'params')
  methodCallNode.documentElement.appendChild(paramsNode)


  let paramNode = document.createElementNS(null, 'param')
  paramsNode.appendChild(paramNode)

  let valueNode = document.createElementNS(null, 'value')
  paramNode.appendChild(valueNode)

  for (let value of values) {
    let stringNode = document.createElementNS(null, 'string')
    stringNode.textContent = value
    paramNode.appendChild(stringNode)
  }


  let serializer = new XMLSerializer()
  let xmlString = serializer.serializeToString(methodCallNode)

  let request = new XMLHttpRequest()
  request.open('POST', 'https://irc.eu.fuelrats.com:6080/xmlrpc', true)

  request.setRequestHeader('Accept-Encoding', 'text/xml')

  request.onload = function () {
    
  }

  request.onerror = function () {

  }

  request.send(xmlString)
}
